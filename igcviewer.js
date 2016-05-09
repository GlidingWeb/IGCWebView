/* global jQuery */
var ns = (function($) {
  'use strict';
    var earthrad = 6378; //  Earth radius km
    var metre2foot= 3.2808399;
    var mps2knot= 1.9426025694;
    var mps2fpm= 196.8503937;
    var kph2knot= 0.53961182484;
    var km2miles=  0.62137119224;
    var altUnits= {};
    var climbUnits= {};
    var cruiseUnits={};
    var speedUnits ={};
    var distanceUnits={};
  var igcFile = null;
  var barogramPlot = null;
  var timezone = {
    zonename: "Europe/London",
    zoneabbr: "UTC",
    offset: 0,
    dst: false
  };
  var task = null;
  var sectordefs = {};
  var mapControl;
  var enlStatus = {};
  var engineRuns = [];
  var igcExtra= null;

  function setEnlDefaults() {
    enlStatus.threshold = 500;
    enlStatus.duration = 12;
    enlStatus.detect = 'Off';
  }

  function showval(converter,value) {
      var conValue=converter.multiplier*value;
      return conValue.toFixed(converter.precision) + converter.descriptor;
  }
  
  function showEnlStatus() {
    $("input[name=enldetect][value=" + enlStatus.detect + "]").prop('checked', true);
    $('#enlthreshold').val(enlStatus.threshold);
    $('#enltime').val(enlStatus.duration);
    $('#enlstatus').text(enlStatus.detect);
  }

  function loadAirspace(midpoint) {
    $.post("getairspace.php",
      {
        lat: midpoint.lat,
        lng: midpoint.lng
      },
      function(data, status) {
        if (status === 'success') {
          mapControl.setAirspace(data);
          mapControl.updateAirspace(Number($("#airclip").val()));
        }
        else {
          alert("Airspace load failed");
        }
      }, "json");
  }

  function showSectors() {
    $('#startrad').val(sectordefs.startrad);
    $('#finishrad').val(sectordefs.finrad);
    $('#tpbarrelrad').val(sectordefs.tprad);
    $('#tpsectorrad').val(sectordefs.sector_rad);
    $('#subtends').val(sectordefs.sector_angle);
    $('#tpbarrel').prop("checked", sectordefs.use_barrel);
    $('#tpsector').prop("checked", sectordefs.use_sector);
    var value = sectordefs.finishtype;
    $("input[name=finishtype][value=" + value + "]").prop('checked', true);
  }

  function setSectors() {
    sectordefs.startrad = $('#startrad').val();
    sectordefs.finrad = $('#finishrad').val();
    sectordefs.tprad = $('#tpbarrelrad').val();
    sectordefs.sector_rad = $('#tpsectorrad').val();
    sectordefs.sector_angle = $('#subtends').val();
    sectordefs.use_barrel = $('#tpbarrel').prop("checked");
    sectordefs.use_sector = $('#tpsector').prop("checked");
    sectordefs.finishtype = $("input[name='finishtype']:checked").val();
  }

  function setSectorDefaults() {
    sectordefs.startrad = 5; //start line radius
    sectordefs.finrad = 1; //finish line radius
    sectordefs.tprad = 0.5; //'beer can' radius
    sectordefs.sector_rad = 20; //tp sector radius
    sectordefs.sector_angle = 90; //tp sector
    sectordefs.use_sector = true;
    sectordefs.use_barrel = true;
    sectordefs.finishtype = "line";
  }

  function enlReality() {
    var configerror = "";
    if ($("input[name='enldetect']:checked").val() === 'On') {
      var threshold = $('#enlthreshold').val();
      var duration = $('#enltime').val();
      if ((threshold < 1) || (threshold > 999)) {
        configerror += "\nIllegal threshold value";
      }
      if ((duration < 2) || (duration > 100)) {
        configerror += "\nUnrealistic time value";
      }
    }
    if (configerror.length > 0) {
      alert(configerror);
      return false;
    } else {
      return true;
    }
  }

  function realityCheck() {
    var configerror = "";

    if (!($('#startrad').val() > 0)) {
      configerror = "\nStart radius needed";
    }
    if (!($('#finishrad').val() > 0)) {
      configerror += "\nFinish radius needed";
    }
    if ((!($('#tpbarrel').prop('checked'))) && (!($('#tpsector').prop('checked')))) {
      configerror += "\nSelect circle and/or sector for TPs";
    }
    if (($('#tpbarrel').prop('checked')) && (!($('#tpbarrelrad').val() > 0))) {
      configerror += "\nTP circle radius needed";
    }
    if (($('#tpsector').prop('checked')) && (!($('#tpsectorrad').val() > 0))) {
      configerror += "\nTP sector radius needed";
    }
    if (configerror.length > 0) {
      alert(configerror);
      return false;
    } else {
      return true;
    }
  }

  function targetPoint(start, distance, bearing) {
    var lat1 = start.lat * Math.PI / 180;
    var lng1 = start.lng * Math.PI / 180;
    var radbrng = bearing * Math.PI / 180;
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / earthrad) + Math.cos(lat1) * Math.sin(distance / earthrad) * Math.cos(radbrng));
    var lng2 = lng1 + Math.atan2(Math.sin(radbrng) * Math.sin(distance / earthrad) * Math.cos(lat1), Math.cos(distance / earthrad) - Math.sin(lat1) * Math.sin(lat2));
    var retlat = lat2 * 180 / Math.PI;
    var retlng = lng2 * 180 / Math.PI;
    retlng = (retlng + 540) % 360 - 180;
    return {
      lat: retlat,
      lng: retlng
    };
  }

  function topoint(start, end) {
    var degLat1;
    var degLng1;
    var degLat2;
    var degLng2;
    if (start.hasOwnProperty("lat")) {
      degLat1 = start.lat;
      degLng1 = start.lng;
    } else {
      degLat1 = start[0];
      degLng1 = start[1];
    }
    if (end.hasOwnProperty("lat")) {
      degLat2 = end.lat;
      degLng2 = end.lng;
    } else {
      degLat2 = end[0];
      degLng2 = end[1];
    }
    var lat1 = degLat1 * Math.PI / 180;
    var lat2 = degLat2 * Math.PI / 180;
    var lon1 = degLng1 * Math.PI / 180;
    var lon2 = degLng2 * Math.PI / 180;
    var deltaLat = lat2 - lat1;
    var deltaLon = lon2 - lon1;
    var a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = earthrad * c;
    var y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    var brng = (360 + Math.atan2(y, x) * 180 / Math.PI) % 360;
    return {
      distance: d,
      bearing: brng
    };
  }

  function getSectorLimits() {
    var i;
    var heading;
    var bearingOut;
    var bisector;
    var legheadings = [];
    var sectorLimits = [];
    for (i = 1; i < task.coords.length; i++) {
      heading = topoint(task.coords[i - 1], task.coords[i]).bearing;
      legheadings.push(heading);
    }
    for (i = 0; i < task.coords.length; i++) {
      var limits = {};
      switch (i) {
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
          if (sectordefs.use_sector) {
            bearingOut = (legheadings[i] + 180) % 360;
            bisector = legheadings[i - 1] + (bearingOut - legheadings[i - 1]) / 2;
            if (Math.abs(bearingOut - legheadings[i - 1]) > 180) {
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
    if (min > max) {
      max += 360;
      if (target < comparison.max) {
        target += 360;
      }
    }
    return ((target > min) && (target < max));
  }

  function getTakeOffIndex() {
    var i = 1;
    var distInterval;
    var groundspeed;
    do {
      distInterval = topoint(igcFile.latLong[i - 1], igcFile.latLong[i]);
      groundspeed = 3600000 * distInterval.distance / (igcFile.recordTime[i].getTime() - igcFile.recordTime[i - 1].getTime());
      i++;
    }
    while (groundspeed < 20);
    return i;
  }

  function getLandingIndex() {
    var distInterval;
    var groundspeed;
    var i = igcFile.latLong.length;
    do {
      i--;
      distInterval = topoint(igcFile.latLong[i - 1], igcFile.latLong[i]);
      groundspeed = 3600000 * distInterval.distance / (igcFile.recordTime[i].getTime() - igcFile.recordTime[i - 1].getTime());
    }
    while ((groundspeed < 20) && (i > 0));
    return i;
  }


  function assessSection(sectionStart, sectionEnd) {
    var i = sectionStart;
    var curLeg = -1;
    var bestSoFar = 0;
    var bestIndex;
    var startstatus;
    var distanceToNext;
    var sectorLimits = getSectorLimits();
    var startIndexLatest;
    var nextstatus;
    var turned;
    var tpindices = [];
    var currentDistance;

    do {
      if (curLeg < 2) { //not reached first TP
        startstatus = topoint(task.coords[0], igcFile.latLong[i]); //check if in start zone
        if ((checksector(startstatus.bearing, sectorLimits[0])) && (startstatus.distance < sectordefs.startrad)) {
          curLeg = 0; // we are  in the start zone
          startIndexLatest = i;
        }
        else {
          if (curLeg === 0) { //if we were in the start zone and now aren't
            curLeg = 1; //we're now on the first leg
            startIndexLatest = i; //and this is our latest recorded start
            distanceToNext = task.legsize[1];
          }
        }
      }
      if ((curLeg > 0) && (curLeg < task.coords.length)) { // if started
        nextstatus = topoint(task.coords[curLeg], igcFile.latLong[i]); //distance to next turning point
        turned = false;
        if (curLeg === task.coords.length - 1) { // If we are on the final leg
          if (nextstatus.distance < sectordefs.finrad) {
            if (sectordefs.finishtype === "circle") {
              turned = true;
            }
            else {
              if (checksector(nextstatus.bearing, sectorLimits[curLeg])) {
                turned = true;
              }
            }
          }
        }
        else {
          if ((sectordefs.use_barrel) && (nextstatus.distance < sectordefs.tprad)) {
            turned = true;
          }
          if (sectordefs.use_sector) {
            if ((checksector(nextstatus.bearing, sectorLimits[curLeg])) && (nextstatus.distance < sectordefs.sector_rad)) {
              turned = true;
            }
          }
        }
        if (turned) {
          bestSoFar = distanceToNext;
          bestIndex = i;
          tpindices[curLeg] = i;
          curLeg++;
          distanceToNext += task.legsize[curLeg];
        }
        else {
          currentDistance = distanceToNext - nextstatus.distance;
          if (currentDistance > bestSoFar) {
            bestSoFar = currentDistance;
            tpindices[0] = startIndexLatest;
            bestIndex = i;
          }
        }
      }
      i++;
    }
    while (i < sectionEnd);
    return {
      npoints: curLeg,
      turnIndices: tpindices,
      scoreDistance: bestSoFar,
      bestPoint: bestIndex
    };
  }

  function showResult(takeoff, landing, assessment) {
    var j;
    var legName;
    var tpAlt = [];
    var timestamp = [];
    var takeOffDate = new Date(igcFile.recordTime[takeoff].getTime() + timezone.offset);
    $('#taskcalcs').text("Take off: " + takeOffDate.getUTCHours() + ':' + pad(takeOffDate.getUTCMinutes()));
    var pressureCheck = igcFile.pressureAltitude.reduce(function(a, b) {
      return a + b;
    }, 0); //total of pressure altitude records
    if (pressureCheck === 0) {
      alert("Pressure altitude not available.  Using GPS");
    }
    for (j = 0; j < task.coords.length; j++) {
      if (j < assessment.npoints) {
        if (pressureCheck > 0) { //if total of pressure altitude records > 0
          tpAlt[j] = igcFile.pressureAltitude[assessment.turnIndices[j]];
        } else {
          tpAlt[j] = igcFile.gpsAltitude[assessment.turnIndices[j]];
        }
        timestamp[j] = igcFile.recordTime[assessment.turnIndices[j]].getTime();
      }
      switch (j) {
        case 0:
          legName = "<br/><br/>Start: ";
          break;
        case task.coords.length - 1:
          legName = "<br/>Finish: ";
          break;
        default:
          legName = "<br/>TP" + j + ": ";
      }
      if (j < assessment.npoints) {
        $('#taskcalcs').append(legName + getPosInfo(timestamp[j], tpAlt[j]));
      } else {
        $('#taskcalcs').append(legName + "No Control");
      }
    }
    if (assessment.npoints === task.coords.length) { //task completed
        $('#taskcalcs').append("<br/><br/>" + showval(distanceUnits,task.distance) + "  task completed");
      $('#taskcalcs').append("<br/>Elapsed time: " + toTimeString(timestamp[task.coords.length - 1] - timestamp[0], true));
      var taskspeed= 3600000 * task.distance / (timestamp[task.coords.length - 1] - timestamp[0]);
      $('#taskcalcs').append("<br/>Speed: " + showval(speedUnits,taskspeed));
      var heightLoss=tpAlt[0] - tpAlt[task.coords.length - 1];
      $('#taskcalcs').append("<br/>Height loss: " + showval(altUnits, (tpAlt[0] - tpAlt[task.coords.length - 1])));
      if (altUnits.multiplier!==1) {
        $('#taskcalcs').append(" (" + (tpAlt[0] - tpAlt[task.coords.length - 1]).toFixed(0) + "m)");
      }
    }
    else {
      if ((assessment.npoints > 0) && (assessment.scoreDistance > 0)) {
        var chickenDate = new Date(igcFile.recordTime[assessment.bestPoint].getTime() + timezone.offset);
        $('#taskcalcs').append("<br/><br/>\"GPS Landing\" at: " + chickenDate.getUTCHours() + ":" + pad(chickenDate.getUTCMinutes()));
        mapControl.pushPin(igcFile.latLong[assessment.bestPoint]);
        $('#taskcalcs').append("<br/>Position: " + pointDescription(igcFile.latLong[assessment.bestPoint]));
        $('#taskcalcs').append("<br/>Scoring distance: " + assessment.scoreDistance.toFixed(2) + " Km");
      }
    }
    var landingDate = new Date(igcFile.recordTime[landing].getTime() + timezone.offset);
    $('#taskcalcs').append("<br/><br/>Landing: " + landingDate.getUTCHours() + ':' + pad(landingDate.getUTCMinutes()));
    $('#taskcalcs').append("<br/>Flight time: " + toTimeString(igcFile.recordTime[landing].getTime() - igcFile.recordTime[takeoff].getTime(), false));
  }

  function getGlidingRuns() {
      var starts=[];
      var ends=[];
      var start=0;
      var i=0;
      do {
          if((engineRuns[i].start- start) > 10) {
          starts.push(start);
          ends.push(engineRuns[i].start);
          }
           start=engineRuns[i].end;
           i++;
      }
      while(i < engineRuns.length);
       if((igcFile.latLong.length - start) > 10) {
       starts.push(start);
       ends.push(igcFile.latLong.length);
       }
      return {starts: starts,
          ends:ends};
  }
  
  function assessTask() {
    var i;
    var glidingStart;
    var glidingEnd;
    var bestLength=0;
    var assessment={};
    var tempAssess={};
    var takeOffIndex = getTakeOffIndex();
    var landingIndex = getLandingIndex();
    if ((enlStatus.detect==='Off') || (engineRuns.length===0)) {
    assessment = assessSection(takeOffIndex, landingIndex);
    }
    else {
        var runlist=getGlidingRuns();
        for(i=0; i < runlist.starts.length; i++) {
            if(runlist.starts[i] < takeOffIndex) {
                runlist.starts[i] = takeOffIndex;
            }
            if(runlist.ends[i] > landingIndex) {
                runlist.ends[i]= landingIndex;
            }
            tempAssess=assessSection(runlist.starts[i],runlist.ends[i]);
            if(tempAssess.scoreDistance > bestLength) {
                bestLength=tempAssess.scoreDistance;
                assessment=tempAssess;
            }
        }
        }
    showResult(takeOffIndex, landingIndex, assessment);
  }

  function getPosInfo(recordTime, altitude) {
    var adjustedTime = new Date(recordTime + timezone.offset);
    var showTime = adjustedTime.getUTCHours() + ':' + pad(adjustedTime.getUTCMinutes()) + ':' + pad(adjustedTime.getSeconds());
    return showTime + ":  Altitude: " + showval(altUnits, altitude);
  }

  function toTimeString(interval, showsecs) {
    var totalSeconds = interval / 1000;
    var secondsPart = Math.round(totalSeconds % 60);
    var totalMinutes = Math.floor(totalSeconds / 60);
    var minutesPart = totalMinutes % 60;
    var hoursPart = Math.floor(totalMinutes / 60);
    var retval = hoursPart + "hrs " + minutesPart + "mins ";
    if (showsecs) {
      retval += secondsPart + "secs";
    }
    return retval;
  }

  function drawSector(task, tpno, sectordefs, mapControl) {
    var interval = 5;
    var j;
    var polydef = [];
    var bearingOut = (task.bearing[tpno + 1] + 180) % 360;
    var bisector = task.bearing[tpno] + (bearingOut - task.bearing[tpno]) / 2;
    if (Math.abs(bearingOut - task.bearing[tpno]) > 180) {
      bisector = (bisector + 180) % 360;
    }
    polydef.push(task.coords[tpno]);
    var sector_startangle = (bisector - sectordefs.sector_angle / 2 + 360) % 360;
    polydef.push(targetPoint(task.coords[tpno], sectordefs.sector_rad, sector_startangle));
    var sector_endangle = (bisector + sectordefs.sector_angle / 2 + 360) % 360;
    var interpoints = sectordefs.sector_angle / interval - 1;
    var azi = sector_startangle;
    for (j = 1; j < interpoints; j++) {
      azi += interval;
      polydef.push(targetPoint(task.coords[tpno], sectordefs.sector_rad, azi));
    }
    polydef.push(targetPoint(task.coords[tpno], sectordefs.sector_rad, sector_endangle));
    polydef.push(task.coords[tpno]);
    mapControl.drawTpSector(polydef);
  }

  function drawStartFin(point, radius, bearing) {
    var brng1 = (bearing + 270) % 360;
    var brng2 = (bearing + 90) % 360;
    var drawStart = targetPoint(point, radius, brng1);
    var drawEnd = targetPoint(point, radius, brng2);
    mapControl.drawTargetLine(drawStart, drawEnd);
  }

  function addSectors(task, sectordefs, mapControl) {
    var j;
    drawStartFin(task.coords[0], sectordefs.startrad, task.bearing[1], mapControl);
    if (sectordefs.finishtype === 'line') {
      drawStartFin(task.coords[task.coords.length - 1], sectordefs.finrad, task.bearing[task.coords.length - 1], mapControl);
    }
    else {
      mapControl.drawTpCircle(task.coords[task.coords.length - 1], sectordefs.tprad);
    }
    for (j = 1; j < task.coords.length - 1; j++) {
      if (sectordefs.use_barrel) {
        mapControl.drawTpCircle(task.coords[j], sectordefs.tprad);
      }
      if (sectordefs.use_sector) {
        drawSector(task, j, sectordefs, mapControl);
      }
    }
  }

  function showTask(mapControl) {
    var i;
    var pointlabel;
    $('#taskbuttons').html("");
    $('#taskinfo').html("");
    for (i = 0; i < task.labels.length; i++) {
      $('#taskinfo').append('<tr><th>' + task.labels[i] + ':</th><td>' + task.names[i] + ':</td><td>' + task.descriptions[i] + '</td></tr>');
      switch (i) {
        case 0:
          pointlabel = "Start";
          break;
        case task.labels.length - 1:
          pointlabel = "Finish";
          break;
        default:
          pointlabel = "TP" + i.toString();
      }
      $('#taskbuttons').append('&nbsp;<button>' + pointlabel + '</button>');
      $('#tasklength').text("Task length: " + task.distance.toFixed(1) + " Km");
      $('#task').show();
    }
    mapControl.addTask(task);
    addSectors(task, sectordefs, mapControl);
    bindTaskButtons(mapControl);
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

  function clearTask(mapControl) {
    $('#taskinfo').html("");
    $('#tasklength').html("");
    $('#taskbuttons').html("");
    mapControl.zapTask();
    $('#task').hide();
    $('#taskdata').hide();
    task = null;
  }

  //Get display information associated with task
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
    for (i = 1; i < points.coords.length; i++) {
      leginfo = topoint(points.coords[i - 1], points.coords[i]);
      //eliminate situation when two successive points are identical (produces a divide by zero error on display. 
      //To allow for FP rounding, within 30 metres is considered identical.
      if (leginfo.distance > 0.03) {
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
    if (names.length > 1) {
      return retval;
    } else {
      return null;
    }
  }

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
    for (count = 0; count < pointregex.length; count++) {
      matchref = instr.match(pointregex[count]);
      if (matchref) {
        switch (count) {
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
              async: false,
              success: function(data) {
                pointname = data.tpname;
                if (pointname !== "Not found") {
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
            if (matchref[4].toUpperCase() === "S") {
              latitude = -latitude;
            }
            longitude = parseFloat(matchref[5]) + parseFloat(matchref[6]) / 60 + parseFloat(matchref[7]) / 60000;
            if (matchref[8].toUpperCase() === "W") {
              longitude = -longitude;
            }
            if (matchref[9].length > 0) {
              pointname = matchref[9];
            }
            statusmessage = "OK";
            break;
          case 3:
            //hh:mm:ss
            latitude = parseFloat(matchref[1]) + parseFloat(matchref[2]) / 60 + parseFloat(matchref[3]) / 3600;
            if (matchref[4].toUpperCase() === "S") {
              latitude = -latitude;
            }
            longitude = parseFloat(matchref[5]) + parseFloat(matchref[6]) / 60 + parseFloat(matchref[7]) / 3600;
            if (matchref[8].toUpperCase() === "W") {
              longitude = -longitude;
            }
            statusmessage = "OK";
            break;
          case 4:
            latitude = parseFloat(matchref[1]) + parseFloat(matchref[2]) / 60 + parseFloat(matchref[3]) / (60 * (Math.pow(10, matchref[3].length)));
            if (matchref[4].toUpperCase() === "S") {
              latitude = -latitude;
            }
            longitude = parseFloat(matchref[5]) + parseFloat(matchref[6]) / 60 + parseFloat(matchref[7]) / (60 * (Math.pow(10, matchref[7].length)));
            if (matchref[8].toUpperCase() === "W") {
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

  function parseUserTask() {
    var input;
    var pointdata;
    var success = true;
    var taskdata = {
      coords: [],
      name: []
    };
    $("#requestdata :input[type=text]").each(function() {
      input = $(this).val().replace(/ /g, '');
      if (input.length > 0) {
        pointdata = getPoint(input);
        if (pointdata.message === "OK") {
          taskdata.coords.push(pointdata.coords);
          taskdata.name.push(pointdata.name);
        } else {
          success = false;
          alert("\"" + $(this).val() + "\"" + " not recognised-" + " ignoring entry");
        }
      }
    });
    if (success) {
      task = maketask(taskdata);
    } else {
      task = null;
    }
  }

  function displaydate(timestamp) {
    var daynames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var monthnames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return daynames[timestamp.getUTCDay()] + " " + timestamp.getUTCDate() + " " + monthnames[timestamp.getUTCMonth()] + " " + timestamp.getUTCFullYear();
  }

  //get timezone data from google.  Via php to avoid cross-domain data request from the browser
  //Timezone dependent processes run  on file load are here as request is asynchronous
  //If the request fails or times out, silently reverts to default (UTC)
  function gettimezone(igcFile, mapControl) {
    var flightdate = igcFile.recordTime[0];
    $.ajax({
      url: "gettimezone.php",
      data: {
        stamp: flightdate / 1000,
        lat: igcFile.latLong[0].lat,
        lon: igcFile.latLong[0].lng
      },
      timeout: 3000,
      method: "POST",
      dataType: "json",
      success: function(data) {
        if (data.status === "OK") {
          timezone.zonename = data.timeZoneId;
          timezone.zoneabbr = data.timeZoneName.match(/[A-Z]/g).join('');
          timezone.offset = 1000 * (parseFloat(data.rawOffset) + parseFloat(data.dstOffset));
          timezone.zonename = data.timeZoneName;
        }
      },
      complete: function() {
        //Local date may not be the same as UTC date
        var localdate = new Date(flightdate.getTime() + timezone.offset);
        $('#datecell').text(displaydate(localdate));
        barogramPlot = plotBarogram(igcFile);
        updateTimeline(0, mapControl);
      }
    });
  }

  function pad(n) {
    return (n < 10) ? ("0" + n.toString()) : n.toString();
  }

  function plotBarogram() {
    var nPoints = igcFile.recordTime.length;
    var pressureBarogramData = [];
    var gpsBarogramData = [];
    var enlData = [];
    var j;
    var timestamp;
    var enlLabel;
    var showEnl;
    if (enlStatus.detect === 'Off') {
      showEnl = false;
      enlLabel = '';
    }
    else {
      showEnl = true;
      enlLabel = 'ENL';
    }
    var startTime = igcFile.recordTime[0].getTime() + timezone.offset;
    for (j = 0; j < nPoints; j++) {
      timestamp = igcFile.recordTime[j].getTime() + timezone.offset;
      pressureBarogramData.push([timestamp, igcFile.pressureAltitude[j] * altUnits.multiplier]);
      gpsBarogramData.push([timestamp, igcFile.gpsAltitude[j] * altUnits.multiplier]);
      enlData.push([timestamp, igcFile.enl[j]]);
    }
    var baro = $.plot($('#barogram'), [{
      label: enlLabel,
      data: enlData,
      yaxis: 2,
      bars: {
        show: showEnl
      },
      lines: {
        show: false
      },
      color: '#D0D0FF'
    }, {
      label: 'GPS altitude',
      data: gpsBarogramData,
      color: '#8080FF'
    }, {
      label: 'Pressure altitude',
      data: pressureBarogramData,
      color: '#FF0000'
    },
    {
      label: '',
      data: [
        [startTime, enlStatus.threshold],
        [timestamp, enlStatus.threshold]
      ],
      color: '#000000',
      yaxis: 2,
      lines: {
        show: showEnl
      }
    }], {
      axisLabels: {
        show: true
      },

      xaxes: [{
        mode: 'time',
        timeformat: '%H:%M',
        axisLabel: 'Time (' + timezone.zonename + ')'
      }],
      yaxes: [{
        axisLabel: 'Altitude / ' +  altUnits.descriptor
      }, {
        position: "right",
        axisLabel: 'Environmental Noise Level',
        min: 20,
        max: 4000,
        show: showEnl,
        ticks: [0, 500, 1000]
      }],

      crosshair: {
        mode: 'xy'
      },

      grid: {
        clickable: true,
        autoHighlight: false
      }
    });
    return baro;
  }

  function updateTimeline(timeIndex, mapControl) {
    var positionText = pointDescription(igcFile.latLong[timeIndex]);
    var adjustedTime = new Date(igcFile.recordTime[timeIndex].getTime() + timezone.offset);
      var displaySentence=adjustedTime.getUTCHours()+ ':' + pad(adjustedTime.getUTCMinutes()) + ':' + pad(adjustedTime.getSeconds()) + " " + timezone.zoneabbr + '; ' +
      showval(altUnits, igcFile.pressureAltitude[timeIndex])  + ' ' + ' (baro) / ' +  positionText;
      if(timeIndex >15) {
          displaySentence += " " + igcExtra.flightMode[timeIndex] + ": " ;
          if( igcExtra.flightMode[timeIndex]==='Cruising') {
              displaySentence+=showval(cruiseUnits,igcExtra.snapspeed[timeIndex]);
          }
         displaySentence+= ": vario " + showval(climbUnits,igcExtra.avgeclimb[timeIndex]);
      }
      $('#timePositionDisplay').html(displaySentence);
    mapControl.setTimeMarker(igcFile.latLong[timeIndex]);
    barogramPlot.lockCrosshair({
      x: adjustedTime.getTime(),
      y: igcFile.pressureAltitude[timeIndex] * altUnits.multiplier
    });
  }

  function bindTaskButtons(mapControl) {
    $('#taskbuttons button').on('click', function(event) {
      var li = $(this).index();
      mapControl.showTP(task.coords[li]);
    });
  }

  function getFileTask(igcFile) {
    if (igcFile.taskpoints.length > 4) {
      var i;
      var pointdata;
      var taskdata = {
        coords: [],
        name: []
      };
      for (i = 1; i < igcFile.taskpoints.length - 1; i++) {
        pointdata = getPoint(igcFile.taskpoints[i]);
        if (pointdata.message === "OK") {
          taskdata.coords.push(pointdata.coords);
          taskdata.name.push(pointdata.name);
        }
      }
      if (taskdata.name.length > 1) {
        return maketask(taskdata);
      }
    }
    else {
      return null;
    }
  }

  function showImported(taskinfo) {

    $("#requestdata :input[type=text]").each(function() {
      $(this).val("");
    });
    clearTask(mapControl);
    task = maketask(taskinfo);
    showTask(mapControl);
    $('#clearTask').show();
  }


  function getEngineRuns() {
    var i = 0;
    var startIndex = null;
    var endIndex;
    var timeInterval;
    engineRuns = []; //clear old data
    do {
      if ((startIndex === null) && (igcFile.enl[i] > enlStatus.threshold)) {
        startIndex = i;
      }
      if ((startIndex !== null) && (igcFile.enl[i] < enlStatus.threshold)) {
        endIndex = i;
        var timeInterval = igcFile.recordTime[i - 1].getTime() - igcFile.recordTime[startIndex].getTime();
        if (timeInterval >= 1000 * enlStatus.duration) {
          engineRuns.push({
            start: startIndex,
            end: endIndex
          });
        }
        startIndex = null;
      }
      i++;
    }
    while (i < igcFile.latLong.length);
  }

  function clearEngineRuns() {
    mapControl.zapEngineRuns();
    engineRuns = [];
  }

  function showEngineRuns() {
    var i;
    var j;
    var coordlist = [];
    for (i = 0; i < engineRuns.length; i++) {
      coordlist = [];
      for (j = engineRuns[i].start; j < engineRuns[i].end; j++) {
        coordlist.push(igcFile.latLong[j]);
      }
      mapControl.showRuns(coordlist);
    }
  }

  function displayIgc(mapControl) {
    //Now done first.  Getting time zone and plotting graph is asyncronous, so do as soon a possible.
    gettimezone(igcFile, mapControl);
    //set bounds for map and get centre of task area
    var taskcentre = mapControl.setBounds(igcFile.bounds);
    if ($("input[name=tasksource][value=infile]").prop('checked')) {
      clearTask(mapControl);
      task = getFileTask(igcFile);
    }

    if (task !== null) {
      showTask(mapControl);
    }
    // Display the headers.
    var headerBlock = $('#headers');
    headerBlock.html('');
    //Delay display of date till we get the timezone
    var headerIndex;
    for (headerIndex = 0; headerIndex < igcFile.headers.length; headerIndex++) {
      headerBlock.append(
        $('<tr></tr>').append($('<th></th>').text(igcFile.headers[headerIndex].name))
        .append($('<td></td>').text(igcFile.headers[headerIndex].value))
      );
    }
    $('#flightInfo').show();
    //map won't display correctly if initialised in a <div> with 'display:none'.  Works OK for 'visibility: hidden'.
    $('#igcFileDisplay').css('visibility', 'visible');
    mapControl.addTrack(igcFile.latLong);
    engineRuns = [];
    if (enlStatus.detect === 'On') {
      getEngineRuns();
      showEngineRuns();
    }
    loadAirspace(taskcentre);
    $('#timeSlider').prop('max', igcFile.recordTime.length - 1);
    document.getElementById("timeSlider").focus();
  }

  function storePreference(name, value) {
    if (window.localStorage) {
      try {
        localStorage.setItem(name, value);
      } catch (e) {
        // If permission is denied, ignore the error.
      }
    }
  }

  function setConverter(unitObj,descriptor,multiplier,precision) {
      unitObj.descriptor= descriptor;
      unitObj.multiplier = multiplier;
      unitObj.precision= precision;
  }

  /*
  function setUnitDefaults() {
     $('#altitudeunits').val("ft");
     $('#climbunits').val("kt");
      $('#cruiseunits').val("kt");
      $('#taskunits').val("kph");
      $('#lengthunits').val("km");
  }
*/
  function reParse() {
      var modelPlus= {
          stdTime: [],
          heading: [],
          distance: [],
           snapspeed: [],
          avgeclimb: [],
          flightMode: [],
          groundspeed: [],
      };
      var i;
      var j;
      var deltaBearing;
      var whereGoing;
      var turnCusum;
      var speedSum;
      modelPlus.stdTime[0]=igcFile.recordTime[0].getTime();
      var timeInterval=Math.round((igcFile.recordTime[igcFile.recordTime.length-1].getTime()-modelPlus.stdTime[0])/igcFile.recordTime.length/1000);
      var timeRange= Math.ceil(30/timeInterval);   //used for calculating 30 second average speed and climb;
      for(i=1; i < igcFile.recordTime.length; i++) {
          modelPlus.flightMode[i]="";
          modelPlus.stdTime[i]= igcFile.recordTime[i].getTime();
          whereGoing=topoint(igcFile.latLong[i-1], igcFile.latLong[i]);
           modelPlus.heading[i]=whereGoing.bearing ;
           modelPlus.distance[i]=whereGoing.distance;
          modelPlus.snapspeed[i]=3600000*whereGoing.distance/(modelPlus.stdTime[i]-modelPlus.stdTime[i-1]);
          if(i > 15) {
                speedSum=0;
                turnCusum=0;
                for(j=i-timeRange; j  <  i; j++) {
                    deltaBearing= (360+modelPlus.heading[j+1]-modelPlus.heading[j])%360;
                    if(Math.abs(deltaBearing) > 180) {
                        deltaBearing -= 360;
                    }
                    turnCusum+=deltaBearing;
                    speedSum+=modelPlus.snapspeed[i];
                }
                if(Math.abs(turnCusum) > 100) {
                    modelPlus.flightMode[i]="Circling";
                }
                else {
                    modelPlus.flightMode[i]="Cruising";
                }
               modelPlus.avgeclimb[i]=1000*(igcFile.pressureAltitude[i-1]- igcFile.pressureAltitude[i-timeRange])/(modelPlus.stdTime[i-1]- modelPlus.stdTime[i-timeRange]);
                modelPlus.groundspeed[i]=speedSum/timeRange;
          }
          else {
              modelPlus.flightMode[i]="";
          }
      }
       return modelPlus;
}

function applyUnits() {
    switch($('#altitudeunits').val()) {
        case "ft":
         setConverter(altUnits," feet",metre2foot,0);
         break;
        case "mt":
         setConverter(altUnits," metres",1,0);
         break;
    }

      switch($('#climbunits').val()) {
          case "kt":
             setConverter(climbUnits," knots",mps2knot,1);
             break;
          case "mps":
              setConverter(climbUnits," m/s",1,1);
              break;
          case "fpm":
            setConverter(climbUnits," ft/min",mps2fpm,0);
              break;   
      }
      switch($('#cruiseunits').val()) {
          case "kt":
             setConverter(cruiseUnits," knots",kph2knot,0);
             break;
          case "kph":
              setConverter(cruiseUnits," km/hr",1,0);
              break;
          case "mph":
            setConverter(cruiseUnits," miles/hr",km2miles,0);
              break;   
      }
       switch($('#taskunits').val()) {
          case "kph":
              setConverter(speedUnits," km/hr",1,2);
              break;
          case "mph":
            setConverter(speedUnits," miles/hr",km2miles,2);
              break;   
      }
       switch($('#lengthunits').val()) {
          case "km":
              setConverter(distanceUnits," Km",1,1);
              break;
          case "miles":
            setConverter(distanceUnits," Miles",km2miles,2);
              break;   
      }
      if (igcFile !== null) {
          plotBarogram();
          var t = parseInt($('#timeSlider').val(), 10);
             updateTimeline(t, mapControl);
        }
      storePreference("altitudeUnit", $('#altitudeunits').val());
      storePreference("climbUnit", $('#climbunits').val());
      storePreference("cruiseUnit", $('#cruiseunits').val());
      storePreference("taskUnit", $('#taskunits').val());
      storePreference("lengthUnit", $('#lengthunits').val());
}

function getStoredValues() {
     try {
       var  storedAltitudeUnit = localStorage.getItem("altitudeUnit");;
        if(storedAltitudeUnit) {
            $('#altitudeunits').val(storedAltitudeUnit);
        }
        var storedClimbUnit=localStorage.getItem("climbUnit");
        if(storedClimbUnit) {
            $('#climbunits').val(storedClimbUnit);
        }
         var storedCruiseUnit=localStorage.getItem("cruiseUnit");
        if(storedCruiseUnit) {
            $('#cruiseunits').val(storedCruiseUnit);
        }
         var storedTaskUnit=localStorage.getItem("taskUnit");
        if(storedTaskUnit) {
            $('#taskunits').val(storedTaskUnit);
        }
        var storedLengthUnit=localStorage.getItem("lengthUnit");
        if(storedLengthUnit) {
            $('#lengthunits').val(storedLengthUnit);
        }
      var storedSectorDefs = localStorage.getItem("sectors");
        if (storedSectorDefs) {
          sectordefs = JSON.parse(storedSectorDefs);
        }
       var  storedEnl = localStorage.getItem("enl");
        if (storedEnl) {
          enlStatus = JSON.parse(storedEnl);
        }
        var storedAirspaceClip = localStorage.getItem("airspaceClip");
        if (storedAirspaceClip) {
          $('#airclip').val(airspaceClip);
        }
      } catch (e) {
        // If permission is denied, ignore the error.
      }
}

  $(document).ready(function() {
    mapControl = createMapControl();
    var planWindow = null;
    window.name = "igcview";
    setSectorDefaults();
    setEnlDefaults();
    applyUnits();
    if (window.localStorage) {
        getStoredValues();
    }
    $("input[name=tasksource][value=infile]").prop('checked', true);
    $('#fileControl').change(function() {
      if (this.files.length > 0) {
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            $('#errorMessage').text('');
            mapControl.reset();
            $('#timeSlider').val(0);
            igcFile = parseIGC(this.result);
            igcExtra=reParse();
            displayIgc(mapControl);
          } catch (ex) {
            if (ex instanceof IGCException) {
              $('#errorMessage').text(ex.message);
            } else {
              throw ex;
            }
          }
        };
        reader.readAsText(this.files[0]);
      }
    });

    $('#help').click(function() {
      window.open("igchelp.html", "_blank");
    });

    $('#about').click(function() {
      window.open("igcabout.html", "_blank");
    });

    $('#applyenl').click(function() {
      if (enlReality()) {
        enlStatus.detect = $("input[name='enldetect']:checked").val();
        enlStatus.threshold = parseInt($('#enlthreshold').val());
        enlStatus.duration = parseInt($('#enltime').val());
        showEnlStatus();
        $('#setenl').hide();
        if (igcFile !== null) {
          plotBarogram();
          if (enlStatus.detect === 'On') {
            getEngineRuns();
            showEngineRuns();
          }
          else {
            clearEngineRuns();
          }
        }
        if ($('#saveenl').prop("checked")) {
          storePreference("enl", JSON.stringify(enlStatus));
        }
      }
    });

    $('#enldefaults').click(function() {
      setEnlDefaults();
      showEnlStatus();
    });

    $('#enlhelp').click(function() {
      window.open("igchelp.html#enl", "_blank");
    });
/*
    $('#altitudeUnits').change(function(e, raisedProgrammatically) {
      var altitudeUnit = $(this).val();
      if (altitudeUnit === 'feet') {
        altitudeConversionFactor = 3.2808399;
      } else {
        altitudeConversionFactor = 1.0;
      }
      if (igcFile !== null) {
        barogramPlot = plotBarogram();
        updateTimeline($('#timeSlider').val(), mapControl);
      }

      if (!raisedProgrammatically) {
        storePreference("altitudeUnit", altitudeUnit);
      }
    });
*/
    // We need to handle the 'change' event for IE, but
    // 'input' for Chrome and Firefox in order to update smoothly
    // as the range input is dragged.
    $('#timeSlider').on('input', function() {
      var t = parseInt($(this).val(), 10);
      updateTimeline(t, mapControl);
    });
    
    $('#timeSlider').on('change', function() {
      var t = parseInt($(this).val(), 10);
      updateTimeline(t, mapControl);
      // var climb= climbRate(t);
      //$('#timePositionDisplay').append(" Climb: " + climb +"m/s");
    });

    $('#airclip').change(function() {
      var clipping = $(this).val();
      if (igcFile !== null) {
        mapControl.updateAirspace(Number(clipping));
      }
      storePreference("airspaceClip", clipping);
    });

    $('#clearTask').click(function() {
      $("#requestdata :input[type=text]").each(function() {
        $(this).val("");
      });
    });

    $('#zoomtrack').click(function() {
      mapControl.zoomToTrack();
    });

    $('button.toggle').click(
      function() {
        $(this).next().toggle();
        if ($(this).next().is(':visible')) {
          $(this).text('Hide');
        } else {
          $(this).text('Show');
        }
      });

    $('#enterTask').click(function() {
      clearTask(mapControl);
      parseUserTask();
      showTask(mapControl);
      $('#taskentry').hide();
      $('#task').show();
    });

    $('#barogram').on('plotclick', function(event, pos, item) {
      if (item) {
        updateTimeline(item.dataIndex, mapControl);
        $('#timeSlider').val(item.dataIndex);
      }
    });

    $('#analyse').click(function() {
      $('#sectors').hide();
      $('taskcalcs').text('');
      $('#taskdata').show();
      assessTask();
    });

    $('#configure').click(function() {
      $('#taskdata').hide();
      $('#sectors').show();
    });

    $('.closewindow').click(function() {
      $(this).parent().hide();
    });

    $('#setsectors').click(function() {
      if (realityCheck()) {
        $('#sectors').hide();
        setSectors();
        if (task !== null) {
          mapControl.zapTask();
          mapControl.addTask(task);
          addSectors(task, sectordefs, mapControl);
        }
        if ($('#savesectors').prop("checked")) {
          storePreference("sectors", JSON.stringify(sectordefs));
        }
      }
    });

    $('#applyunits').click(function() {
        applyUnits();
        $(this).parent().hide();
    });
    
    $('#tpdefaults').click(function() {
      setSectorDefaults();
      showSectors();
    });

    $('#enl').click(function() {
      $('#setenl').show();
    });

    $('#unitconfig').click(function() {
      $('#setunits').show();
    });
    
    $('input[type=radio][name=tasksource]').change(function() {
      switch (this.value) {
        case "infile":
          $('#taskentry').hide();
          clearTask(mapControl);
          task = getFileTask(igcFile);
          showTask(mapControl);
          $('#task').show();
          break;
        case "user":
          $('#task').hide();
          $('#taskentry').show();
          break;
        case "xcplan":
          if ((!(planWindow)) || (planWindow.closed)) {
            planWindow = window.open("../TaskMap/xcplan.php?version=world", "_blank");
          }
          planWindow.focus();
          break;
        case "nix":
          $('#taskentry').hide();
          clearTask(mapControl);
          task = null;
      }
    });
/*
    var storedAltitudeUnit = '',
      airspaceClip = '';
    var storedSectorDefs;
    var storedEnl;
    if (window.localStorage) {
      try {
        storedAltitudeUnit = localStorage.getItem("altitudeUnit");
        if (storedAltitudeUnit) {
          $('#altitudeUnits').val(storedAltitudeUnit).trigger('change', true);
        }
        storedSectorDefs = localStorage.getItem("sectors");
        if (storedSectorDefs) {
          sectordefs = JSON.parse(storedSectorDefs);
        }
        storedEnl = localStorage.getItem("enl");
        if (storedEnl) {
          enlStatus = JSON.parse(storedEnl);
        }
        airspaceClip = localStorage.getItem("airspaceClip");
        if (airspaceClip) {
          $('#airclip').val(airspaceClip);
        }
      } catch (e) {
        // If permission is denied, ignore the error.
      }
    }
    */
    $('#saveenl').prop("checked", false);
    showSectors();
    showEnlStatus();
  });
  return {
    importTask: function(taskinfo) {
      showImported(taskinfo);
      return "Task entered successfully";
    }
  }
}(jQuery));
