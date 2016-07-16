var EARTHRAD = 6378; //  Earth radius km

function pad(n) {
  return(n < 10) ? ("0" + n.toString()) : n.toString();
}

function targetPoint(start, distance, bearing) {
  var lat1 = start.lat * Math.PI / 180;
  var lng1 = start.lng * Math.PI / 180;
  var radbrng = bearing * Math.PI / 180;
  var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / EARTHRAD) + Math.cos(lat1) * Math.sin(distance / EARTHRAD) * Math.cos(radbrng));
  var lng2 = lng1 + Math.atan2(Math.sin(radbrng) * Math.sin(distance / EARTHRAD) * Math.cos(lat1), Math.cos(distance / EARTHRAD) - Math.sin(lat1) * Math.sin(lat2));
  var retlat = lat2 * 180 / Math.PI;
  var retlng = lng2 * 180 / Math.PI;
  retlng = (retlng + 540) % 360 - 180;
  return {
    lat: retlat,
    lng: retlng
  };
}

function getStartFin(point, radius, bearing) {
  var retval = {};
  retval.type = "line";
  var brng1 = (bearing + 270) % 360;
  var brng2 = (bearing + 90) % 360;
  retval.start = targetPoint(point, radius, brng1);
  retval.end = targetPoint(point, radius, brng2);
  return retval;
}

function getCircle(coords, radius) {
  var retval = {};
  retval.type = "circle";
  retval.centre = coords;
  retval.radius = radius;
  return retval;
}

function getSegment(target, tpno, defs) {
  var retval = {};
  var interval = 5;
  var j;
  var polydef = [];
  retval.type = "segment";
  var bearingOut = (target.bearing[tpno + 1] + 180) % 360;
  var bisector = target.bearing[tpno] + (bearingOut - target.bearing[tpno]) / 2;
  if(Math.abs(bearingOut - target.bearing[tpno]) > 180) {
    bisector = (bisector + 180) % 360;
  }
  polydef.push(target.coords[tpno]);
  var sector_startangle = (bisector - defs.sector_angle / 2 + 360) % 360;
  polydef.push(targetPoint(target.coords[tpno], defs.sector_rad, sector_startangle));
  var sector_endangle = (bisector + defs.sector_angle / 2 + 360) % 360;
  var interpoints = defs.sector_angle / interval - 1;
  var azi = sector_startangle;

  for(j = 1; j < interpoints; j++) {
    azi += interval;
    polydef.push(targetPoint(target.coords[tpno], defs.sector_rad, azi));
  }
  polydef.push(targetPoint(target.coords[tpno], defs.sector_rad, sector_endangle));
  polydef.push(target.coords[tpno]);
  retval.outline = polydef;
  return retval;
}

function getSectors(target, defs) {
  var j;
  var features = [];

  features.push(getStartFin(target.coords[0], defs.startrad, target.bearing[1]));
  if(defs.finishtype === 'line') {
    features.push(getStartFin(target.coords[target.coords.length - 1], defs.finrad, target.bearing[target.coords.length - 1]));
  } else {
    features.push(getCircle(target.coords[target.coords.length - 1], defs.finrad));
  }
  for(j = 1; j < target.coords.length - 1; j++) {
    if(defs.use_barrel) {
      features.push(getCircle(target.coords[j], defs.tprad));
    }
    if(defs.use_sector) {
      var segment_detail = getSegment(target, j, defs);
      features.push(segment_detail);
    }
  }
  return features;
}

function pointDescription(coords) {
  var latdegrees = Math.abs(coords['lat']);
  var latdegreepart = Math.floor(latdegrees);
  var latminutepart = 60 * (latdegrees - latdegreepart);
  var latdir = (coords['lat'] > 0) ? "N" : "S";
  var lngdegrees = Math.abs(coords['lng']);
  var lngdegreepart = Math.floor(lngdegrees);
  var lngminutepart = 60 * (lngdegrees - lngdegreepart);
  var lngdir = (coords['lng'] > 0) ? "E" : "W";

  var retstr = latdegreepart.toString() + "&deg;" + latminutepart.toFixed(3) + "&prime;" + latdir + " " + lngdegreepart.toString() + "&deg;" + lngminutepart.toFixed(3) + "&prime;" + lngdir;
  return retstr;
}

function topoint(start, end) {
  var lat1 = start.lat * Math.PI / 180;
  var lat2 = end.lat * Math.PI / 180;
  var lon1 = start.lng * Math.PI / 180;
  var lon2 = end.lng * Math.PI / 180;
  var deltaLat = lat2 - lat1;
  var deltaLon = lon2 - lon1;
  var a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = EARTHRAD * c;
  var y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  var brng = (360 + Math.atan2(y, x) * 180 / Math.PI) % 360;
  return {
    distance: d,
    bearing: brng
  };
}

function maketask(points) {
  var i;
  var j = 1;
  var distance = 0;
  var leginfo;
  var names = [];
  var labels = [];
  var coords = [];
  var descriptions = [];
  var legsize = [];
  var bearing = [];

  names[0] = points.name[0];
  labels[0] = "Start";
  coords[0] = points.coords[0];
  descriptions[0] = pointDescription(points.coords[0]);
  legsize[0] = 0;
  bearing[0] = 0;
  for(i = 1; i < points.coords.length; i++) {
    leginfo = topoint(points.coords[i - 1], points.coords[i]);
    //eliminate situation when two successive points are identical (produces a divide by zero error on display. 
    //To allow for FP rounding, within 30 metres is considered identical.
    if(leginfo.distance > 0.03) {
      names[j] = points.name[i];
      coords[j] = points.coords[i];
      descriptions[j] = pointDescription(points.coords[i]);
      labels[j] = "TP" + j;
      legsize[j] = leginfo.distance;
      bearing[j] = leginfo.bearing;
      distance += leginfo.distance;
      j++;
    }
  }
  labels[labels.length - 1] = "Finish";
  var retval = {
    names: names,
    labels: labels,
    coords: coords,
    descriptions: descriptions,
    legsize: legsize,
    distance: distance,
    bearing: bearing
  };
  //Must be at least two points more than 30 metres apart
  if(names.length > 1) {
    return retval;
  } else {
    return null;
  }
}

//Parses a text input.  Matches to BGA list, Welt2000 list, or lat/long input  Retrieves coordinates and name
function getPoint(instr) {
  var latitude;
  var longitude;
  var pointname = "Not named";
  var matchref;
  var statusmessage = "Fail";
  var count;
  var coords = {};
  var pointregex = [
    /^([A-Za-z]{2}[A-Za-z0-9]{1})$/,
    /^([A-Za-z0-9]{6})$/,
    /^([\d]{2})([\d]{2})([\d]{3})([NnSs])([\d]{3})([\d]{2})([\d]{3})([EeWw])(.*)$/,
    /^([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2})[\s]*([NnSs])[\W]*([0-9]{1,3}):([0-9]{1,2}):([0-9]{1,2})[\s]*([EeWw])$/,
    /^(\d{1,2})[\s:](\d{1,2})\.(\d{1,3})\s*([NnSs])\s*(\d{1,3})[\s:](\d{1,2})\.(\d{1,3})\s*([EeWw])$/
  ];
  for(count = 0; count < pointregex.length; count++) {
    matchref = instr.match(pointregex[count]);
    if(matchref) {
      switch(count) {
      case 0:
      case 1:
        //BGA or Welt2000 point
        $.ajax({
          url: "findtp.php",
          data: {
            postdata: matchref[0]
          },
          timeout: 3000,
          method: "POST",
          dataType: "json",
          async: false, //must be synchronous as order in which points are returned is important
          success: function (data) {
            pointname = data.tpname;
            if(pointname !== "Not found") {
              latitude = data.latitude;
              longitude = data.longitude;
              statusmessage = "OK";
            }
          }
        });
        break;
      case 2:
        //format in IGC file
        latitude = parseFloat(matchref[1]) + parseFloat(matchref[2]) / 60 + parseFloat(matchref[3]) / 60000;
        if(matchref[4].toUpperCase() === "S") {
          latitude = -latitude;
        }
        longitude = parseFloat(matchref[5]) + parseFloat(matchref[6]) / 60 + parseFloat(matchref[7]) / 60000;
        if(matchref[8].toUpperCase() === "W") {
          longitude = -longitude;
        }
        if(matchref[9].length > 0) {
          pointname = matchref[9];
        }
        if((latitude !== 0) && (longitude !== 0)) {
          statusmessage = "OK";
        }
        break;
      case 3:
        //hh:mm:ss
        latitude = parseFloat(matchref[1]) + parseFloat(matchref[2]) / 60 + parseFloat(matchref[3]) / 3600;
        if(matchref[4].toUpperCase() === "S") {
          latitude = -latitude;
        }
        longitude = parseFloat(matchref[5]) + parseFloat(matchref[6]) / 60 + parseFloat(matchref[7]) / 3600;
        if(matchref[8].toUpperCase() === "W") {
          longitude = -longitude;
        }
        break;
      case 4:
        latitude = parseFloat(matchref[1]) + parseFloat(matchref[2]) / 60 + parseFloat(matchref[3]) / (60 * (Math.pow(10, matchref[3].length)));
        if(matchref[4].toUpperCase() === "S") {
          latitude = -latitude;
        }
        longitude = parseFloat(matchref[5]) + parseFloat(matchref[6]) / 60 + parseFloat(matchref[7]) / (60 * (Math.pow(10, matchref[7].length)));
        if(matchref[8].toUpperCase() === "W") {
          longitude = -longitude;
        }
        statusmessage = "OK";
        break;
      }
    }
  }
  coords.lat = latitude;
  coords.lng = longitude;
  return {
    message: statusmessage,
    coords: coords,
    name: pointname
  };
}

function getSectorLimits(task, sectordefs) {
  var i;
  var heading;
  var bearingOut;
  var bisector;
  var legheadings = [];
  var sectorLimits = [];
  for(i = 1; i < task.coords.length; i++) {
    heading = topoint(task.coords[i - 1], task.coords[i])
      .bearing;
    legheadings.push(heading);
  }
  for(i = 0; i < task.coords.length; i++) {
    var limits = {};
    switch(i) {
    case 0: //start zone
      heading = legheadings[0];
      limits.max = heading - 90;
      limits.min = heading + 90;
      break;
    case task.coords.length - 1: //finish line
      heading = legheadings[i - 1];
      limits.max = heading + 90;
      limits.min = heading - 90;
      break;
    default:
      if(sectordefs.use_sector) {
        bearingOut = (legheadings[i] + 180) % 360;
        bisector = legheadings[i - 1] + (bearingOut - legheadings[i - 1]) / 2;
        if(Math.abs(bearingOut - legheadings[i - 1]) > 180) {
          bisector = (bisector + 180) % 360;
        }
        limits.max = bisector + sectordefs.sector_angle / 2;
        limits.min = bisector - sectordefs.sector_angle / 2;
      }
    }
    limits.max = (limits.max + 360) % 360;
    limits.min = (limits.min + 360) % 360;
    sectorLimits.push(limits);
  }
  return sectorLimits;
}


function checksector(target, comparison) {
  var min = comparison.min;
  var max = comparison.max;
  if(min > max) {
    max += 360;
    if(target < comparison.max) {
      target += 360;
    }
  }
  return((target > min) && (target < max));
}

function assessSection(igcFile, task, sectionStart, sectionEnd, sectorLimits, sectordefs) {
  var i = sectionStart;
  var curLeg = -1;
  var bestSoFar = 0;
  var bestIndex;
  var startstatus;
  var distanceToNext;
  var startIndexLatest;
  var nextstatus;
  var turned;
  var tpindices = [];
  var currentDistance;
  do {
    if(curLeg < 2) { //not reached first TP
      startstatus = topoint(task.coords[0], igcFile.latLong[i]); //check if in start zone
      if((checksector(startstatus.bearing, sectorLimits[0])) && (startstatus.distance < sectordefs.startrad)) {
        curLeg = 0; // we are  in the start zone
        startIndexLatest = i;
      } else {
        if(curLeg === 0) { //if we were in the start zone and now aren't
          curLeg = 1; //we're now on the first leg
          startIndexLatest = i; //and this is our latest recorded start
          distanceToNext = task.legsize[1];
        }
      }
    }
    if((curLeg > 0) && (curLeg < task.coords.length)) { // if started
      nextstatus = topoint(task.coords[curLeg], igcFile.latLong[i]); //distance to next turning point
      turned = false;
      if(curLeg === task.coords.length - 1) { // If we are on the final leg
        if(nextstatus.distance < sectordefs.finrad) {
          if(sectordefs.finishtype === "circle") {
            turned = true;
          } else {
            if(checksector(nextstatus.bearing, sectorLimits[curLeg])) {
              turned = true;
            }
          }
        }
      } else {
        if((sectordefs.use_barrel) && (nextstatus.distance < sectordefs.tprad)) {
          turned = true;
        }
        if(sectordefs.use_sector) {
          if((checksector(nextstatus.bearing, sectorLimits[curLeg])) && (nextstatus.distance < sectordefs.sector_rad)) {
            turned = true;
          }
        }
      }
      if(turned) {
        bestSoFar = distanceToNext;
        bestIndex = i;
        tpindices[curLeg] = i;
        curLeg++;
        distanceToNext += task.legsize[curLeg];
      } else {
        currentDistance = distanceToNext - nextstatus.distance;
        if(currentDistance > bestSoFar) {
          bestSoFar = currentDistance;
          tpindices[0] = startIndexLatest;
          bestIndex = i;
        }
      }
    }
    i++;
  }
  while (i < sectionEnd);
  if(bestSoFar === 0) { //allow for crossing start line than going backwards
    curLeg = 0;
  }
  return {
    npoints: curLeg,
    turnIndices: tpindices,
    scoreDistance: bestSoFar,
    bestPoint: bestIndex
  };
}

function assessTask(igcFile, task, enlStatus, sectordefs, engineRuns) {
  var assessment;
  var sectorLimits = getSectorLimits(task, sectordefs);
  var tempAssess;
  var bestLength = 0;
  var i;
  if((enlStatus.detect === 'Off') || (engineRuns.length === 0)) {
    assessment = assessSection(igcFile, task, igcFile.takeOffIndex, igcFile.landingIndex, sectorLimits, sectordefs);
  } else {
    for(i = 0; i < engineRuns.glidingRuns.start.length; i++) {
      tempAssess = assessSection(igcFile, task, engineRuns.glidingRuns.start[i], engineRuns.glidingRuns.end[i], sectorLimits, sectordefs);
      if(tempAssess.scoreDistance > bestLength) {
        bestLength = tempAssess.scoreDistance;
        assessment = tempAssess;
      }
    }
  }
  return assessment;
}

function getEngineState(igcFile, enl) {
  var i = 0;
  var startIndex = null;
  var timeInterval;
  var engineRun = [];
  var runList = [];
  var glidingRuns = {
    start: [],
    end: []
  };
  glidingRuns.start.push(0);
  do {
    if(igcFile.enl[i] > enl.threshold) {
      engineRun.push(igcFile.latLong[i]);
      if(startIndex === null) {
        startIndex = i;
      }
    } else {
      if(startIndex !== null) {
        timeInterval = igcFile.recordTime[i - 1] - igcFile.recordTime[startIndex];
        if(timeInterval >= enl.duration) {
          glidingRuns.end.push(startIndex);
          glidingRuns.start.push(i);
          runList.push(engineRun);
        }
        engineRun = [];
        startIndex = null;
      }
    }
    i++;
  }
  while (i < igcFile.landingIndex); //ignore taxying post landing
  glidingRuns.end.push(igcFile.landingIndex);
  return {
    engineTrack: runList,
    glidingRuns: glidingRuns
  };
}

function getTurnRate(igcFile) {
  var turnRate = [];
  var i;
  var deltaBearing;
  var whereGoing;
  var preVector = topoint(igcFile.latLong[0], igcFile.latLong[1]);
  var prevBearing = preVector.bearing;
  var snapTurn;
  turnRate[0] = 0;
  for(i = 1; i < igcFile.recordTime.length; i++) {
    whereGoing = topoint(igcFile.latLong[i - 1], igcFile.latLong[i]);
    deltaBearing = Math.round((360 + whereGoing.bearing - prevBearing) % 360);
    prevBearing = whereGoing.bearing;
    if(Math.abs(deltaBearing) > 180) {
      deltaBearing -= 360;
    }
    snapTurn = deltaBearing / (igcFile.recordTime[i] - igcFile.recordTime[i - 1]);
    turnRate.push(snapTurn);
  }
  return turnRate;
}
