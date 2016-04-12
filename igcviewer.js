/* global L */
/* global jQuery */
var ns = (function($) {
  'use strict';
  var igcFile = null;
  var barogramPlot = null;
  var altitudeConversionFactor = 3.2808399; // Conversion from metres to required units
  var timezone = {
    zonename: "Europe/London",
    zoneabbr: "UTC",
    offset: 0,
    dst: false
  };
  var task = null;
  var sectordefs = {};
  var mapControl;


  function loadAirspace() {
    $.post("getairspace.php",
      {
        lat: igcFile.latLong[0][0],
        lng: igcFile.latLong[0][1]
      },
      function(data, status) {
        if (status === 'success') {
          mapControl.setAirspace(data);
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

  function topoint(start, end) {
    var earthrad = 6378; //  Earth radius km
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

  function analyseTask(mapControl) {
    var flying = false;
    var distInterval;
    var groundspeed;
    var takeoffTime;
    var i = 1;
    var startstatus;
    var nextstatus;
    var tpindices = [];
    var turned;
    var j;
    var tpAlt;
    var timestamp;
    var legName;
    var bestIndex;
    var distanceToNext;
    var currentDistance;
    var startIndexLatest;
    var startTime;
    var finishTime;
    var finishAlt;
    var bestSoFar = 0;
    var curLeg = -1;
    var sectorLimits = getSectorLimits();
    do {
      if (!(flying)) {
        distInterval = topoint(igcFile.latLong[i - 1], igcFile.latLong[i]);
        groundspeed = 3600000 * distInterval.distance / (igcFile.recordTime[i].getTime() - igcFile.recordTime[i - 1].getTime());
        if (groundspeed > 20) {
          flying = true;
          takeoffTime = igcFile.recordTime[i].getTime();
          var takeOffDate = new Date(takeoffTime + timezone.offset);
          $('#taskcalcs').text("Take off: " + takeOffDate.getUTCHours() + ':' + pad(takeOffDate.getUTCMinutes()));
        }
      }
      if (curLeg < 2) { //not reached first TP
        startstatus = topoint(task.coords[0], igcFile.latLong[i]); //check if in start zone
        if ((checksector(startstatus.bearing, sectorLimits[0])) && (startstatus.distance < sectordefs.startrad)) {
          curLeg = 0;
          startIndexLatest = tpindices[0];
        }
        else {
          if (curLeg === 0) {
            curLeg = 1;
            startIndexLatest=i;
            distanceToNext = task.legsize[1];
            timestamp = igcFile.recordTime[i].getTime();
          }
        }
      }
      if ((curLeg > 0) && (curLeg < task.coords.length)) {
        nextstatus = topoint(task.coords[curLeg], igcFile.latLong[i]);
        turned = false;
        if (curLeg === task.coords.length - 1) {
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
        } else {
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
          if (curLeg === 1) {
            startIndexLatest = tpindices[0]; //last start before maximimum distance.  We stop checking for start after TP1
          }
          curLeg++;
          distanceToNext += task.legsize[curLeg];
        } else
        {
          currentDistance = distanceToNext - nextstatus.distance;
          if (currentDistance > bestSoFar) {
            bestSoFar = currentDistance;
            tpindices[0]=startIndexLatest;
            bestIndex = i;
          }
        }
      }
      i++;
    }
    while ((i < igcFile.latLong.length) && (curLeg < task.coords.length));
    i = igcFile.latLong.length;
    do {
      i--;
      distInterval = topoint(igcFile.latLong[i - 1], igcFile.latLong[i]);
      groundspeed = 3600000 * distInterval.distance / (igcFile.recordTime[i].getTime() - igcFile.recordTime[i - 1].getTime());
    }
    while ((groundspeed < 20) && (i > 0));
    var landingTime = igcFile.recordTime[i].getTime();
    var landingDate = new Date(landingTime + timezone.offset);
    var pressureCheck = igcFile.pressureAltitude.reduce(function(a, b) {
      return a + b;
    }, 0); //total of pressure altitude records
    if (pressureCheck === 0) {
      alert("Pressure altitude not available.  Using GPS");
    }
    if ((curLeg === 0) && (bestSoFar > 0)) { //if landed in the start zone before TP 1 but have started
      tpindices[0] = startIndexLatest; //take last point crossing line as a start
      curLeg = 1; //and assume we are still on the first leg
    }
    for (j = 0; j < task.coords.length; j++) {
      if (j < curLeg) {
        if (pressureCheck > 0) { //if total of pressure altitude records > 0
          tpAlt = igcFile.pressureAltitude[tpindices[j]];
        } else {
          tpAlt = igcFile.gpsAltitude[tpindices[j]];
        }
        timestamp = igcFile.recordTime[tpindices[j]].getTime();
      }
      switch (j) {
        case 0:
          legName = "<br/><br/>Start: ";
          startTime = timestamp;
          var startAlt = tpAlt;
          break;
        case task.coords.length - 1:
          legName = "<br/>Finish: ";
          finishTime = timestamp;
          finishAlt = tpAlt;
          break;
        default:
          legName = "<br/>TP" + j + ": ";
      }
      if (j < curLeg) {
        $('#taskcalcs').append(legName + getPosInfo(timestamp, tpAlt));
      } else {
        $('#taskcalcs').append(legName + "No Control");
      }
    }
    if (curLeg === task.coords.length) { //task completed
      $('#taskcalcs').append("<br/><br/>" + task.distance.toFixed(2) + " Km task completed");
      $('#taskcalcs').append("<br/>Elapsed time: " + toTimeString(finishTime - startTime, true));
      $('#taskcalcs').append("<br/>Speed: " + (3600000 * task.distance / (finishTime - startTime)).toFixed(2) + " km/hr");
      $('#taskcalcs').append("<br/>Height loss: " + (altitudeConversionFactor * (startAlt - finishAlt)).toFixed(0) + " " + $('#altitudeUnits').val());
      if (altitudeConversionFactor !== 1) {
        $('#taskcalcs').append(" (" + (startAlt - finishAlt).toFixed(0) + "m)");
      }
    }
    else
    {
      if ((curLeg > 0) && (bestSoFar > 0)) {
        var chickenDate = new Date(igcFile.recordTime[bestIndex].getTime() + timezone.offset);
        $('#taskcalcs').append("<br/><br/>\"GPS Landing\" at: " + chickenDate.getUTCHours() + ":" + pad(chickenDate.getUTCMinutes()));
        mapControl.pushPin(igcFile.latLong[bestIndex]);
        $('#taskcalcs').append("<br/>Position: " + pointDescription(L.latLng(igcFile.latLong[bestIndex])));
        $('#taskcalcs').append("<br/>Scoring distance: " + bestSoFar.toFixed(2) + " Km");
      }
    }
    $('#taskcalcs').append("<br/><br/>Landing: " + landingDate.getUTCHours() + ':' + pad(landingDate.getUTCMinutes()));
    $('#taskcalcs').append("<br/>Flight time: " + toTimeString(landingTime - takeoffTime, false));

  }

  function getPosInfo(recordTime, altitude) {
    var adjustedTime = new Date(recordTime + timezone.offset);
    var showTime = adjustedTime.getUTCHours() + ':' + pad(adjustedTime.getUTCMinutes()) + ':' + pad(adjustedTime.getSeconds());
    return showTime + ":  Altitude: " + (altitude * altitudeConversionFactor).toFixed(0) + " " + $('#altitudeUnits').val();
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
    mapControl.addTask(task.coords, task.labels, sectordefs);
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
    var leglength;
    var names = [];
    var labels = [];
    var coords = [];
    var descriptions = [];
    var legsize = [];
    names[0] = points.name[0];
    labels[0] = "Start";
    coords[0] = points.coords[0];
    descriptions[0] = pointDescription(points.coords[0]);
    legsize[0] = 0;
    for (i = 1; i < points.coords.length; i++) {
      leglength = points.coords[i].distanceTo(points.coords[i - 1]);
      //eliminate situation when two successive points are identical (produces a divide by zero error on display. 
      //To allow for FP rounding, within 30 metres is considered identical.
      if (leglength > 30) {
        names[j] = points.name[i];
        coords[j] = points.coords[i];
        descriptions[j] = pointDescription(points.coords[i]);
        labels[j] = "TP" + j;
        legsize[j] = leglength / 1000;
        distance += leglength;
        j++;
      }
    }
    labels[labels.length - 1] = "Finish";
    distance = distance / 1000;
    var retval = {
      names: names,
      labels: labels,
      coords: coords,
      descriptions: descriptions,
      legsize: legsize,
      distance: distance
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

    return {
      message: statusmessage,
      coords: L.latLng(latitude, longitude),
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

  //get timezone data from timezonedb.  Via php to avoid cross-domain data request from the browser
  //Timezone dependent processes run  on file load are here as request is asynchronous
  //If the request fails or times out, silently reverts to default (UTC)
  function gettimezone(igcFile, mapControl) {
    var flightdate = igcFile.recordTime[0];
    $.ajax({
      url: "gettimezone.php",
      data: {
        stamp: flightdate / 1000,
        lat: igcFile.latLong[0][0],
        lon: igcFile.latLong[0][1]
      },
      timeout: 3000,
      method: "POST",
      dataType: "json",
      success: function(data) {
        if (data.status === "OK") {
          timezone.zonename = data.zoneName;
          timezone.zoneabbr = data.abbreviation;
          timezone.offset = 1000 * parseFloat(data.gmtOffset);
          if (data.dst === "1") {
            timezone.zonename += ", daylight saving";
          }
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
    var j;
    var timestamp;
    for (j = 0; j < nPoints; j++) {
      timestamp = igcFile.recordTime[j].getTime() + timezone.offset;
      pressureBarogramData.push([timestamp, igcFile.pressureAltitude[j] * altitudeConversionFactor]);
      gpsBarogramData.push([timestamp, igcFile.gpsAltitude[j] * altitudeConversionFactor]);
    }
    var baro = $.plot($('#barogram'), [{
      label: 'Pressure altitude',
      data: pressureBarogramData
    }, {
      label: 'GPS altitude',
      data: gpsBarogramData
    }], {
      axisLabels: {
        show: true
      },
      xaxis: {
        mode: 'time',
        timeformat: '%H:%M',
        axisLabel: 'Time (' + timezone.zonename + ')'
      },
      yaxis: {
        axisLabel: 'Altitude / ' + $('#altitudeUnits').val()
      },

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
    var currentPosition = igcFile.latLong[timeIndex];
    var positionText = pointDescription(L.latLng(currentPosition));
    var unitName = $('#altitudeUnits').val();
    //add in offset from UTC then convert back to UTC to get correct time in timezone!
    var adjustedTime = new Date(igcFile.recordTime[timeIndex].getTime() + timezone.offset);
    $('#timePositionDisplay').html(adjustedTime.getUTCHours() + ':' + pad(adjustedTime.getUTCMinutes()) + ':' + pad(adjustedTime.getSeconds()) + " " + timezone.zoneabbr + '; ' +
      (igcFile.pressureAltitude[timeIndex] * altitudeConversionFactor).toFixed(0) + ' ' +
      unitName + ' (barometric) / ' +
      (igcFile.gpsAltitude[timeIndex] * altitudeConversionFactor).toFixed(0) + ' ' +
      unitName + ' (GPS); ' + positionText);
    mapControl.setTimeMarker(timeIndex);

    barogramPlot.lockCrosshair({
      x: adjustedTime.getTime(),
      y: igcFile.pressureAltitude[timeIndex] * altitudeConversionFactor
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
    var tpoints = {
      name: [],
      coords: []
    };
    var i;
    $("#requestdata :input[type=text]").each(function() {
      $(this).val("");
    });
    clearTask(mapControl);
    for (i = 0; i < taskinfo.tpname.length; i++) {
      tpoints.name.push(taskinfo.tpname[i]);
      tpoints.coords.push(L.latLng(taskinfo.lat[i], taskinfo.lng[i]));
    }
    task = maketask(tpoints);
    showTask(mapControl);
    $('#clearTask').show();
  }

  function displayIgc(mapControl) {
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
    // Reveal the map and graph. We have to do this before
    // setting the zoom level of the map or plotting the graph.
    $('#igcFileDisplay').show();
    mapControl.addTrack(igcFile.latLong);
    loadAirspace();
    //Barogram is now plotted on "complete" event of timezone query
    gettimezone(igcFile, mapControl);
    // Set airspace clip altitude to selected value and show airspace for the current window
    //mapControl.updateAirspace(Number($("#airclip").val()));
    //Enable automatic update of the airspace layer as map moves or zooms
    //mapControl.activateEvents();
    $('#timeSlider').prop('max', igcFile.recordTime.length - 1);
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

  $(document).ready(function() {
    mapControl = createMapControl('map');
    mapControl.setClipAlt($('#airclip').val());
    var planWindow = null;
    var altitudeUnit = $('#altitudeUnits').val();
    if (altitudeUnit === 'feet') {
      altitudeConversionFactor = 3.2808399;
    } else {
      altitudeConversionFactor = 1.0;
    }
    window.name = "igcview";
    setSectorDefaults();
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
      analyseTask(mapControl);
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
          mapControl.addTask(task.coords, task.labels, sectordefs);
        }
        if ($('#savesectors').prop("checked")) {
          storePreference("sectors", JSON.stringify(sectordefs));
        }
      }
    });

    $('#tpdefaults').click(function() {
      setSectorDefaults();
      showSectors();
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
          clearTask(mapControl);
          task = null;
      }
    });

    var storedAltitudeUnit = '',
      airspaceClip = '';
    var storedSectorDefs;
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
        airspaceClip = localStorage.getItem("airspaceClip");
        if (airspaceClip) {
          $('#airclip').val(airspaceClip);
        }
      } catch (e) {
        // If permission is denied, ignore the error.
      }
    }
    showSectors();
  });
  return {
    importTask: function(taskinfo) {
      showImported(taskinfo);
      return "Task entered successfully";
    }
  }
}(jQuery));
