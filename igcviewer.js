var ns = (function ($) {
  'use strict';
  var sectordefs = {};
  var enlStatus = {};
  var altRef;
  var altSource;
  var mapControl;
  var task = null;
  var igcFile = null;
  var planWindow;
  var startElevation;
  var altOffset;
  var barogramPlot = null;
  var engineRuns = {};
  var turnRate = [];
  var timezone = {
    zonename: "Europe/London",
    zoneabbr: "UTC",
    offset: 0,
    dst: false
  };

  function showval(converter, value) {
    var conValue = converter.multiplier * value;
    return conValue.toFixed(converter.precision) + converter.descriptor;
  }

  function getAltOffset() {
    var baseAlt;
    var offset;
    var i = -1;

    if (altRef === 'std') {
      offset = 0;
    } else {
      if (altSource === 'baro') {
        baseAlt = igcFile.pressureAltitude[0]; //assume pressure altititude in every record from the start
      } else { //find first 3D fix
        do {
          i++;
        }
        while ((igcFile.fixQuality[i] !== 'A') || (i > (igcFile.fixQuality.length - 1))); //allow for badly formed file
        baseAlt = igcFile.gpsAltitude[i];
      }
      offset = -baseAlt;
      if (altRef === 'QNH') {
        offset = startElevation - baseAlt;
      }
    }
    return offset;
  }

  function plotBarogram() {
    var nPoints = igcFile.recordTime.length;
    var barogramData = [];
    var enlData = [];
    var j;
    var timestamp;
    var enlLabel;
    var showEnl;
    var altitudeLabel;
    var plotColour;

    if (enlStatus.detect === 'Off') {
      showEnl = false;
      enlLabel = '';
    } else {
      showEnl = true;
      enlLabel = 'ENL';
    }
    var startTime = 1000 * (igcFile.recordTime[0] + timezone.offset);
    for (j = 0; j < nPoints; j++) {
      timestamp = 1000 * (igcFile.recordTime[j] + timezone.offset);
      if (altSource === "baro") {
        barogramData.push([timestamp, (igcFile.pressureAltitude[j] + altOffset) * altUnits.multiplier]);
      } else {
        if (igcFile.fixQuality[j] === 'A') { //if using gps altitude ignore 2D fixes
          barogramData.push([timestamp, (igcFile.gpsAltitude[j] + altOffset) * altUnits.multiplier]);
        }
      }
      enlData.push([timestamp, igcFile.enl[j]]);
    }
    if (altSource === "baro") {
      altitudeLabel = "Pressure Altitude";
      plotColour = '#FF0000';
      switch (altRef) {
      case "QFE":
        altitudeLabel += " (QFE takeoff)";
        break;
      case "QNH":
        altitudeLabel += " (QNH)";
        break;
      case "std":
        altitudeLabel += " (ref 1013mb)";
        break;
      }
    } else {
      altitudeLabel = "GPS Altitude";
      plotColour = '#8080FF';
      switch (altRef) {

      case "QFE":
        altitudeLabel += " (rel. takeoff)";
        break;
      case "QNH":
        altitudeLabel += " (rel.msl)";
        break;
      case "std":
        altitudeLabel += " (file data)";
        break;
      }
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
      label: altitudeLabel,
      data: barogramData,
      color: plotColour
    }, {
      label: '',
      data: [
        [startTime, 0],
        [timestamp, 0]
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
        axisLabel: 'Altitude / ' + altUnits.descriptor
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

  function storePreference(name, value) {
    if (window.localStorage) {
      try {
        localStorage.setItem(name, value);
      } catch (e) {
        // If permission is denied, ignore the error.
      }
    }
  }

  function getStoredValues() {
    try {
      var storedAltitudeUnit = localStorage.getItem("altitudeUnit");
      if (storedAltitudeUnit) {
        $('#altitudeunits').val(storedAltitudeUnit);
      }
      var storedClimbUnit = localStorage.getItem("climbUnit");
      if (storedClimbUnit) {
        $('#climbunits').val(storedClimbUnit);
      }
      var storedCruiseUnit = localStorage.getItem("cruiseUnit");
      if (storedCruiseUnit) {
        $('#cruiseunits').val(storedCruiseUnit);
      }
      var storedTaskUnit = localStorage.getItem("taskUnit");
      if (storedTaskUnit) {
        $('#taskunits').val(storedTaskUnit);
      }
      var storedLengthUnit = localStorage.getItem("lengthUnit");
      if (storedLengthUnit) {
        $('#lengthunits').val(storedLengthUnit);
      }
      var storedSectorDefs = localStorage.getItem("sectors");
      if (storedSectorDefs) {
        sectordefs = JSON.parse(storedSectorDefs);
      }
      var storedEnl = localStorage.getItem("enl");
      if (storedEnl) {
        enlStatus = JSON.parse(storedEnl);
      }
      var storedAltRef = localStorage.getItem("altRef");
      if (storedAltRef) {
        $("input[name='alttype']").val([storedAltRef]);
      }
      var storedAltSource = localStorage.getItem("altSource");
      if (storedAltSource) {
        $("input[name='altsource']")
          .val([storedAltSource]);
      }
      var storedAirspaceClip = localStorage.getItem("airspaceClip");
      if (storedAirspaceClip) {
        $('#airclip').val(storedAirspaceClip);
      }
    } catch (e) {
      // If permission is denied, ignore the error.
    }
  }

  //Set up user defined units 

  var altUnits = {};
  var climbUnits = {};
  var cruiseUnits = {};
  var speedUnits = {};
  var distanceUnits = {};

  function setConverter(unitObj, descriptor, multiplier, precision, abbr) {
    unitObj.descriptor = descriptor;
    unitObj.multiplier = multiplier;
    unitObj.precision = precision;
    unitObj.abbr = abbr;
  }

  function applyUnits() {
    //Conversion factors
    var METRE2FOOT = 3.2808399;
    var MPS2KNOT = 1.9426025694;
    var MPS2FPM = 196.8503937;
    var KPH2KNOT = 0.53961182484;
    var KM2MILES = 0.62137119224;

    switch ($('#altitudeunits').val()) {
    case "ft":
      setConverter(altUnits, " feet", METRE2FOOT, 0, "ft");
      break;
    case "mt":
      setConverter(altUnits, " metres", 1, 0, "mt");
      break;
    }

    switch ($('#climbunits').val()) {
    case "kt":
      setConverter(climbUnits, " knots", MPS2KNOT, 1, "kt");
      break;
    case "mps":
      setConverter(climbUnits, " m/s", 1, 1, "mps");
      break;
    case "fpm":
      setConverter(climbUnits, " ft/min", MPS2FPM, 0, "fpm");
      break;
    }

    switch ($('#cruiseunits').val()) {
    case "kt":
      setConverter(cruiseUnits, " knots", KPH2KNOT, 0, "kt");
      break;
    case "kph":
      setConverter(cruiseUnits, " km/hr", 1, 0, "kph");
      break;
    case "mph":
      setConverter(cruiseUnits, " miles/hr", KM2MILES, 0, "mph");
      break;
    }

    switch ($('#taskunits').val()) {
    case "kph":
      setConverter(speedUnits, " km/hr", 1, 2, "kph");
      break;
    case "mph":
      setConverter(speedUnits, " miles/hr", KM2MILES, 2, "mph");
      break;
    }
    switch ($('#lengthunits').val()) {
    case "km":
      setConverter(distanceUnits, " Km", 1, 1, "km");
      break;
    case "miles":
      setConverter(distanceUnits, " Miles", KM2MILES, 2, "miles");
      break;
    }
    if (task !== null) {
      showTaskLength(task.distance);
    }
    if (igcFile !== null) {
      barogramPlot = plotBarogram();
      var t = parseInt($('#timeSlider').val(), 10);
      updateTimeline(t, mapControl);
    }
    storePreference("altitudeUnit", $('#altitudeunits').val());
    storePreference("climbUnit", $('#climbunits').val());
    storePreference("cruiseUnit", $('#cruiseunits').val());
    storePreference("taskUnit", $('#taskunits').val());
  }

  function restoreUnits() {
    $('#altitudeunits').val(altUnits.abbr);
    $('#climbunits').val(climbUnits.abbr);
    $('#cruiseunits').val(cruiseUnits.abbr);
    $('#taskunits').val(speedUnits.abbr);
    $('#lengthunits').val(distanceUnits.abbr);
  }
  //end of user defined units

  //User defined tp sectors
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

  function sectorsRealityCheck() {
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
    if (($('#tpsector').prop('checked')) && (!($('#tpsectorrad')
        .val() > 0))) {
      configerror += "\nTP sector radius needed";
    }
    if (configerror.length > 0) {
      alert(configerror);
      return false;
    } else {
      return true;
    }
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
    if (task !== null) {
      addSectors();
    }
  }

  //end of sector definition
  //start of enl section

  function setEnlDefaults() {
    enlStatus.threshold = 500;
    enlStatus.duration = 12;
    enlStatus.detect = 'Off';
  }

  function showEnlStatus() {
    $("input[name=enldetect][value=" + enlStatus.detect + "]").prop('checked', true);
    $('#enlthreshold').val(enlStatus.threshold);
    $('#enltime').val(enlStatus.duration);
    $('#enl').html("Engine (" + enlStatus.detect + ")");
  }

  function setEnl() {
    enlStatus.detect = $("input[name='enldetect']:checked").val();
    enlStatus.threshold = parseInt($('#enlthreshold').val());
    enlStatus.duration = parseInt($('#enltime').val());
    $('#enl').html("Engine (" + enlStatus.detect + ")");
    if (barogramPlot) {
      barogramPlot = plotBarogram();
    }
    if (igcFile) {
      if (enlStatus.detect === 'On') {
        engineRuns = getEngineState(igcFile, enlStatus);
        mapControl.showEngineRuns(engineRuns.engineTrack);
      } else {
        mapControl.zapEngineRuns();
      }
    }
  }

  function enlRealityCheck() {
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

  //end of enl configuration
  //start of altitude reporting

  function restoreAltRefs() {
    $("input[name='alttype']").val([altRef]);
    $("input[name='altsource']").val([altSource]);
  }

  function setAltRefs() {
    altRef = $("input[name='alttype']").filter(':checked').val();
    altSource = $("input[name='altsource']").filter(':checked').val();
    if (igcFile) {
      altOffset = getAltOffset();
      barogramPlot = plotBarogram();
      var t = parseInt($('#timeSlider').val(), 10);
      updateTimeline(t, mapControl);
    }
  }

  //end of setting user defined reporting options

  function clearTask() {
    $('#taskbuttons').html("");
    $('#taskinfo').html("");
    task = null;
    mapControl.clearTask();
  }

  function getFileTask() {
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
    } else {
      return null;
    }
  }

  function getUserTask() {
    var input;
    var pointdata;
    var success = true;
    var taskdata = {
      coords: [],
      name: []
    };
    $("#requestdata :input[type=text]").each(function () {
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
    if (taskdata.name.length > 1) {
      if (success) {
        return maketask(taskdata);
      } else {
        return null;
      }
    }
  }

  function addSectors() {
    var featurelist = {};
    featurelist = getSectors(task, sectordefs);
    mapControl.drawSectors(featurelist);
  }

  function showTaskLength(distance) {
    var convDistance = distanceUnits.multiplier * distance;
    $('#tasklength').text("Task distance: " + convDistance.toFixed(distanceUnits.precision) + " " + distanceUnits.descriptor);
  }

  function bindTaskButtons() {
    $('#taskbuttons button').on('click', function (event) {
        var li = $(this).index();
        mapControl.showTP(task.coords[li]);
      });
  }

  function showTask() {
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
    }
    showTaskLength(task.distance);

    $('#task').show();
    $('#map').css('visibility', 'visible');
    mapControl.addTask(task);
    addSectors();
    bindTaskButtons();
  }

  function getFromPlanner(version) {
    var planUrl = "../TaskMap/xcplan.php?version=" + version;
    if ((!(planWindow)) || (planWindow.closed)) {
      planWindow = window.open(planUrl, "_blank");
    }
    planWindow.focus();
  }

  function gettimezone() {
    var flightdate = igcFile.flightDate;
    return $.ajax({
      url: "gettimezone.php",
      data: {
        stamp: flightdate,
        lat: igcFile.latLong[0].lat,
        lon: igcFile.latLong[0].lng
      },
      timeout: 3000,
      method: "POST",
      dataType: "json"
    });
  }

  function getElevation(index) {
    return $.ajax({
      url: "getelevation.php",
      data: {
        lat: igcFile.latLong[index].lat,
        lon: igcFile.latLong[index].lng
      },
      timeout: 3000,
      method: "POST",
      dataType: "json"
    });
  }

  function displayDate(timestamp) {
    var daynames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var monthnames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var localdate = new Date(1000 * timestamp);
    return daynames[localdate.getUTCDay()] + " " + localdate.getUTCDate() + " " + monthnames[localdate.getUTCMonth()] + " " + localdate.getUTCFullYear();
  }

  function getClimb(timeIndex) {
    var climb;
    var prevIndex = timeIndex - Math.ceil(30 / igcFile.timeInterval);
    if (altSource === "baro") {
      climb = (igcFile.pressureAltitude[timeIndex] - igcFile.pressureAltitude[prevIndex]) / (igcFile.recordTime[timeIndex] - igcFile.recordTime[prevIndex]);
    } else {
      climb = (igcFile.gpsAltitude[timeIndex] - igcFile.gpsAltitude[prevIndex]) / (igcFile.recordTime[timeIndex] - igcFile.recordTime[prevIndex]);
    }
    var climbstr = climb.toFixed(2);
    if (climb > 0) {
      climbstr = "+" + climbstr;
    }
    return climbstr;
  }

  function getDisplayTime(timestamp) {
    var adjustedTime = (86400 + timestamp + timezone.offset) % 86400;
    return pad(Math.floor(adjustedTime / 3600)) + ":" + pad(Math.floor((adjustedTime / 60) % 60)) + ":" + pad(adjustedTime % 60);
  }

  function updateTimeline(timeIndex) {
    var positionText = pointDescription(igcFile.latLong[timeIndex]);
    var displaySentence;
    var altValue;
    displaySentence = getDisplayTime(igcFile.recordTime[timeIndex]) + " " + timezone.zoneabbr + '; ' + altRef + " (" + altSource + ") ";
    if (altSource === "baro") {
      altValue = igcFile.pressureAltitude[timeIndex];
    } else {
      altValue = igcFile.gpsAltitude[timeIndex];
    }
    displaySentence += showval(altUnits, altValue + altOffset);
    displaySentence += "; " + positionText;
    if (igcFile.timeInterval * timeIndex > 30) {
      var climb = getClimb(timeIndex);
      displaySentence += ";  vario: " + showval(climbUnits, climb);
    }
    $('#timePositionDisplay').html(displaySentence);
    mapControl.setTimeMarker(igcFile.latLong[timeIndex]);
    var xval = 1000 * (igcFile.recordTime[timeIndex] + timezone.offset);
    var yval = (altValue + altOffset) * altUnits.multiplier;
    barogramPlot.lockCrosshair({
      x: xval,
      y: yval
    });
  }

  function showPositionDetail(timeIndex) {
    $.when(getElevation(timeIndex))
      .done(function (data, status) {
        if (status === 'success') {
          var groundElevation = data.results[0].elevation;
          var gliderAlt;
          if (igcFile.hasPressure) {
            gliderAlt = igcFile.pressureAltitude[timeIndex] - igcFile.pressureAltitude[0] + startElevation;
          } else {
            gliderAlt = igcFile.gpsAltitude[timeIndex] - igcFile.gpsAltitude[igcFile.takeOffGps] + startElevation;
          }
          $('#heightAGL').text("Height above ground: " + showval(altUnits, gliderAlt - groundElevation));
        }
      });
    var startPos = timeIndex - Math.ceil(30 / igcFile.timeInterval); //30 second spread of data
    //get average turn rate over ~last 30 secs
    var cuSum = 0;
    var i;
    var j;
    for (i = startPos; i <= timeIndex; i++) {
      cuSum += turnRate[i];
    }
    var avgeTurn = Math.abs(cuSum / (i - startPos));
    if (avgeTurn > 4) {
      $('#flightMode').text("Flight mode: Circling");
      var circling = true;
      var thermalDetail = "Data for this thermal:<br>Height gain: ";
      //assume if we are turning at less than 4 deg./sec for 15 seconds we are flying straight
      var pointsToCheck = Math.ceil(15 / igcFile.timeInterval);
      i = timeIndex;
      do {
        i--;
        if (Math.abs(turnRate[i]) < 5) {
          circling = false;
          for (j = 1; j <= pointsToCheck; j++) {
            if (Math.abs(turnRate[i - j]) > 4) {
              circling = true;
            }
          }
        }
      }
      while (circling);
      var thermalStartIndex = i;
      i = timeIndex;
      circling = true;
      do {
        i++;
        if (Math.abs(turnRate[i]) < 5) {
          circling = false;
          for (j = 1; j <= pointsToCheck; j++) {
            if (Math.abs(turnRate[i + j]) > 4) {
              circling = true;
            }
          }
        }
      }
      while (circling);
      var thermalTopIndex = i;
      var heightGain;
      var climbTime = igcFile.recordTime[thermalTopIndex] - igcFile.recordTime[thermalStartIndex];
      if (altSource === "baro") {
        heightGain = igcFile.pressureAltitude[thermalTopIndex] - igcFile.pressureAltitude[thermalStartIndex];
      } else {
        heightGain = igcFile.gpsAltitude[thermalTopIndex] - igcFile.gpsAltitude[thermalStartIndex];
      }
      thermalDetail += showval(altUnits, heightGain);
      thermalDetail += "<br>Time taken: " + Math.floor((climbTime / 60) % 60) + "mins " + pad(climbTime % 60) + "secs<br><br>Average climb: ";
      var thermalAvge = heightGain / climbTime;
      thermalDetail += showval(climbUnits, thermalAvge);
      $('#flightdetail1').html(thermalDetail);
    }

    if (avgeTurn < 2) {
      $('#flightMode').text("Flight mode: Cruising");
      if (startPos > 0) {
        var cruiseInfo = topoint(igcFile.latLong[startPos], igcFile.latLong[timeIndex]);
        var cruiseSpeed = 3600 * cruiseInfo.distance / (igcFile.recordTime[timeIndex] - igcFile.recordTime[startPos]);
        $('#flightdetail1').text("Ground speed: " + showval(cruiseUnits, cruiseSpeed));
      }
    }
  }

  function loadAirspace(margin) {
    $.post("getairspace.php", {
        bounds: JSON.stringify(igcFile.bounds),
        margin: margin
      },
      function (data, status) {
        if (status === 'success') {
          mapControl.setAirspace(data);
          mapControl.updateAirspace(Number($("#airclip").val()));
        } else {
          alert("Airspace load failed");
        }
      }, "json");
  }

  function reportFlight() {
    $('#sectordefs').hide();
    $('taskcalcs').text('');
    $('#taskdata').show();
    $('#taskcalcs').html("Take off:  " + getDisplayTime(igcFile.recordTime[igcFile.takeOffIndex]) + "<br>");
    if (task) {
      var i;
      var altValue = [];
      var elapsedTime;
      var taskData = assessTask(igcFile, task, enlStatus, sectordefs, engineRuns);
      for (i = 0; i < task.coords.length; i++) {
        $('#taskcalcs').append("<br/>" + task.labels[i] + ": ");
        if (i < taskData.npoints) {
          $('#taskcalcs').append(getDisplayTime(igcFile.recordTime[taskData.turnIndices[i]]) + ": Altitude: ");
          if (altSource === "baro") {
            altValue[i] = igcFile.pressureAltitude[taskData.turnIndices[i]];
          } else {
            altValue[i] = igcFile.gpsAltitude[taskData.turnIndices[i]];
          }
          $('#taskcalcs').append(showval(altUnits, altValue[i] + altOffset));
        } else {
          $('#taskcalcs').append("No control");
        }
      }

      if (taskData.npoints === task.coords.length) { //task completed
        $('#taskcalcs').append("<br/><br/>" + task.distance.toFixed(distanceUnits.precision) + " " + distanceUnits.descriptor + "  task completed");
        elapsedTime = igcFile.recordTime[taskData.turnIndices[taskData.npoints - 1]] - igcFile.recordTime[taskData.turnIndices[0]];
        $('#taskcalcs').append("<br/>Elapsed time: " + Math.floor(elapsedTime / 3600) + "hrs " + pad(Math.floor((elapsedTime / 60) % 60)) + "mins " + pad(elapsedTime % 60) + "secs");
        $('#taskcalcs').append("<br/>Speed: " + showval(speedUnits, 3600 * task.distance / elapsedTime));
        $('#taskcalcs').append("<br/>Height loss: " + showval(altUnits, altValue[0] - altValue[task.coords.length - 1]));
        if (altUnits.abbr !== 'mt') {
          $('#taskcalcs').append(" (" + (altValue[0] - altValue[task.coords.length - 1]) + "m)");
        }
      } else {
        if (taskData.npoints > 0) {
          $('#taskcalcs').append("<br/><br/>\"GPS Landing\" at: " + getDisplayTime(igcFile.recordTime[taskData.bestPoint]));
          $('#taskcalcs').append("<br/>Position: " + pointDescription(igcFile.latLong[taskData.bestPoint]));
          $('#taskcalcs').append("<br/>Scoring distance: " + showval(distanceUnits, taskData.scoreDistance));
          mapControl.pushPin(igcFile.latLong[taskData.bestPoint]);
        }
      }
    }
    $('#taskcalcs').append("<br/><br/>Landing: " + getDisplayTime(igcFile.recordTime[igcFile.landingIndex]));
    var flightSeconds = igcFile.recordTime[igcFile.landingIndex] - igcFile.recordTime[igcFile.takeOffIndex];
    $('#taskcalcs').append("<br/><br/>Flight time: " + Math.floor(flightSeconds / 3600) + "hrs " + pad(Math.round(flightSeconds / 60) % 60) + "mins");
  }

  function displayIgc() {
    if ((altSource === "baro") && !(igcFile.hasPressure)) {
      alert("Pressure altitude not available.\nUsing GPS");
      altSource = "gps";
    }
    //Call this first as process is asynchronous- can run while the map is being drawn
    $.when(gettimezone(), getElevation(0)).done(function (tzargs, elargs) {
        if (tzargs[0].status === 'OK') {
          timezone.zoneabbr = tzargs[0].timeZoneName.match(/[A-Z]/g).join('');
          timezone.offset = parseFloat(tzargs[0].rawOffset) + parseFloat(tzargs[0].dstOffset);
          timezone.zonename = tzargs[0].timeZoneName;
        } else {
          timezone.zoneabbr = "UTC";
          timezone.offset = 0;
          timezone.zonename = "UTC";
        }
        if (elargs[0].status === 'OK') {
          startElevation = elargs[0].results[0].elevation;
        } else {
          startElevation = null;
        }
        altOffset = getAltOffset();
        var localtime = igcFile.flightDate + timezone.offset;
        $('#datecell').text(displayDate(localtime));
        barogramPlot = plotBarogram(igcFile);
        updateTimeline(0);
      });
    // Display the headers.
    var headerBlock = $('#headers');
    headerBlock.html('');
    var headerIndex;
    for (headerIndex = 0; headerIndex < igcFile.headers.length; headerIndex++) {
      headerBlock.append(
        $('<tr></tr>').append($('<th></th>').text(igcFile.headers[headerIndex].name)).append($('<td></td>').text(igcFile.headers[headerIndex].value))
      );
    }
    $('#flightInfo').show();
    mapControl.addTrack(igcFile.latLong);
    $('#flightinfo').show();
    $('#timeSlider').prop('max', igcFile.recordTime.length - 1);
    if ((igcFile.taskpoints.length > 4) && ($('input[type=radio][name=tasksource]').filter(':checked').val() === "infile")) {
      $('#task').hide();
      clearTask();
      task = getFileTask();
      if (task) {
        showTask();
      }
    }
    mapControl.setBounds(igcFile.bounds);
    if (enlStatus.detect === 'On') {
      engineRuns = getEngineState(igcFile, enlStatus);
      //alert(JSON.stringify(engineRuns.engineTrack));
      mapControl.showEngineRuns(engineRuns.engineTrack);
    }
    loadAirspace(20); //Show airspace in track bounding rectangle + 20 Km margin
    turnRate = getTurnRate(igcFile);
  }

  $(document).ready(function () {
      mapControl = createMapControl();
      applyUnits();
      setSectorDefaults();
      setEnlDefaults();
      getStoredValues();
      showSectors();
      showEnlStatus();
      setEnl();
      setAltRefs();
      window.name = "igcview";
      
      $('#help').click(function () {
          window.open("igchelp.html", "_blank");
        });
      
       $('#about').click(function () {
          window.open("igcabout.html", "_blank");
        });
      
      $('#fileControl').change(function () {
          if (this.files.length > 0) {
            var reader = new FileReader();
            reader.onload = function (e) {
              try {
                // mapControl.reset();
                $('#timeSlider').val(0);
                igcFile = parseIGC(this.result);
                displayIgc();
              } catch (ex) {
                if (ex instanceof IGCException) {
                  alert(ex.message);
                } else {
                  throw ex;
                }
              }
            };
            reader.readAsText(this.files[0]);
          }
        });

      //user configuration section
      //unit configuration panel
      $('#unitconfig').click(function () {
          $('#setunits').show();
        });

      $('#applyunits').click(function () {
          applyUnits();
          $(this).parent().hide();
        });

      $('#cancelunits').click(function () {
          restoreUnits();
          $(this).parent().hide();
        });

      //end of unit configuration
      //start of tp configuration section

      $('#sectorconfig')
        .click(function () {
          $('#sectordefs')
            .show();
        });

      $('#tpdefaults').click(function () {
          setSectorDefaults();
          showSectors();
        });

      $('#setsectors').click(function () {
          if (sectorsRealityCheck()) {
            $('#sectordefs').hide();
            setSectors();
            if ($('#savesectors').prop("checked")) {
              storePreference("sectors", JSON.stringify(sectordefs));
            }
          }
        });

      $('#cancelsectors').click(function () {
          $(this).parent().hide();
        });

      //end of tp configuration panel
      //start of enl configuration panel

      $('#enl').click(function () {
          $('#setenl').show();
        });

      $('#enlhelp').click(function () {
          window.open("igchelp.html#enl", "_blank");
        });

      $('#enldefaults').click(function () {
          setEnlDefaults();
          showEnlStatus();
        });

      $('#cancelenl').click(function () {
          $(this).parent().hide();
        });

      $('#applyenl').click(function () {
          if (enlRealityCheck()) {
            $('#setenl').hide();
            setEnl();
            if ($('#saveenl').prop("checked")) {
              storePreference("enl", JSON.stringify(enlStatus));
            }
          }
        });

      //end of enl configuration panel
      //start of altitude configuration panel

      $('#altref').click(function () {
          $('#setaltref').show();
        });

      $('#althelp').click(function () {
          window.open("igchelp.html#alt", "_blank");
        });

      $('#restorealtref').click(function () {
          restoreAltRefs();
          $(this).parent().hide();
        });

      $('#applyaltref').click(function () {
          setAltRefs();
          storePreference("altRef", altRef);
          storePreference("altSource", altSource);
          $(this).parent().hide();
        });

      //end of altitude reference section

      $('#airclip').change(function () {
          var clipping = $(this).val();
          if (igcFile) {
            mapControl.updateAirspace(Number(clipping));
          }
          storePreference("airspaceClip", clipping);
        });

      $('#enterTask').click(function () {
          task = getUserTask();
          $('#taskentry').hide();
          showTask();
        });

      $('#clearTask').click(function () {
          $("#requestdata :input[type=text]").each(function () {
              $(this).val("");
            });
        });

      // We need to handle the 'change' event for IE, but
      // 'input' for Chrome and Firefox in order to update smoothly
      // as the range input is dragged.
      $('#timeSlider').on('input', function () {
          $('#positionDetail').hide();
          var t = parseInt($(this).val(), 10);
          updateTimeline(t);
        });

      $('#timeSlider').on('change', function () {
          $('#positionDetail').hide();
          var t = parseInt($(this).val(), 10);
          updateTimeline(t);
        });

      $('#barogram').on('plotclick', function (event, pos, item) {
          if (item) {
            updateTimeline(item.dataIndex);
            showPositionDetail(item.dataIndex);
            $('#timeSlider').val(item.dataIndex);
          }
        });

      $('button.toggle').click(
          function () {
            $(this).next().toggle();
            if ($(this).next().is(':visible')) {
              $(this).text('Hide');
            } else {
              $(this).text('Show');
            }
          });

      $('#zoomtrack').click(function () {
          mapControl.setBounds(igcFile.bounds);
        });

      $('#analyse').click(function () {
          if (igcFile) {
            reportFlight();
          }
        });

      $('.closewindow').click(function () {
          $(this).parent().hide();
        });

      $('#moreData').click(function () {
          $('#positionDetail').show();
          var t = parseInt($('#timeSlider').val(), 10);
          showPositionDetail(t);
        });

      $('input[type=radio][name=tasksource]').change(function () {
          $('#taskentry').hide();
          $('#task').hide();
          clearTask();
          switch (this.value) {
          case "infile":
            if (igcFile) {
              task = getFileTask();
              if (task) {
                showTask();
              } else {
                alert("No declaration found");
              }
            }
            break;
          case "user":
            $('#taskentry').show();
            break;
          case "xcplan":
            getFromPlanner(this.id);
            break;
          case "nix":
            clearTask();
            break;
          }
        });
    });
  return {
    importTask: function (taskinfo) {
      task = maketask(taskinfo);
      showTask();
      return "Task entered successfully";
    }
  };
}(jQuery));
