// Constructor for an exception which is thrown if the file
// being parsed is not in a valid IGC format.
function IGCException(message) {
  'use strict';
  this.message = message;
  this.name = "IGCException";
}

// Parses an IGC logger file.
function parseManufacturer(aRecord) {
  var manufacturers = {
    'ACT': 'Aircotec',
    'CAM': 'Cambridge Aero Instruments',
    'CNI': 'Clearnav Instruments',
    'DSX': 'Data Swan',
    'EWA': 'EW Avionics',
    'FIL': 'Filser',
    'FLA': 'FLARM',
    'FLY': 'Flytech',
    'GCS': 'Garrecht',
    'IMI': 'IMI Gliding Equipment',
    'LGS': 'Logstream',
    'LXN': 'LX Navigation',
    'LXV': 'LXNAV d.o.o.',
    'NAV': 'Naviter',
    'NKL': 'Nielsen Kellerman',
    'NTE': 'New Technologies s.r.l.',
    'PES': 'Peschges',
    'PFE': 'PressFinish Technologies',
    'PRT': 'Print Technik',
    'SCH': 'Scheffel',
    'SDI': 'Streamline Data Instruments',
    'TRI': 'Triadis Engineering GmbH',
    'WES': 'Westerboer',
    'XCS': 'XCSoar',
    'ZAN': 'Zander'
  };
  var manufacturerInfo = {
    manufacturer: 'Unknown',
    serial: aRecord.substring(4, 7)
  };

  var manufacturerCode = aRecord.substring(1, 4);
  if(manufacturers[manufacturerCode]) {
    manufacturerInfo.manufacturer = manufacturers[manufacturerCode];
  }
  return manufacturerInfo;
}

function extractDate(igcFile) {
  // Date is recorded as: HFDTEddmmyy (where HFDTE is a literal and dddmmyy are digits).
  //All dates and times now stored as Unix time
  var dateRecord = igcFile.match(/H[FO]DTE([\d]{2})([\d]{2})([\d]{2})/);
  if(dateRecord === null) {
    throw new IGCException('The file does not contain a date header.');
  }
  var day = parseInt(dateRecord[1], 10);
  // Javascript numbers months from zero, not 1!
  var month = parseInt(dateRecord[2], 10) - 1;
  // The IGC specification has a built-in Millennium Bug (2-digit year).
  // I will arbitrarily assume that any year before "80" is in the 21st century.
  var year = parseInt(dateRecord[3], 10);
  if(year < 80) {
    year += 2000;
  } else {
    year += 1900;
  }
  var filedate = new Date(Date.UTC(year, month, day));
  return filedate.getTime() / 1000;
}

function getReadEnl(iRecord) {
  var charpt = iRecord.search("ENL");
  if(charpt > 6) {
    var pos = iRecord.substring(charpt - 4, charpt);
    return {
      start: parseInt(pos.substring(0, 2)) - 1,
      end: parseInt(pos.substring(2, 4))
    };
  } else {
    return null;
  }
}

function parseHeader(headerRecord) {
  var headerSubtypes = {
    'PLT': 'Pilot',
    'CM2': 'Crew member 2',
    'GTY': 'Glider type',
    'GID': 'Glider ID',
    'DTM': 'GPS Datum',
    'RFW': 'Firmware version',
    'RHW': 'Hardware version',
    'FTY': 'Flight recorder type',
    'GPS': 'GPS',
    'PRS': 'Pressure sensor',
    'FRS': 'Security suspect, use validation program',
    'CID': 'Competition ID',
    'CCL': 'Competition class'
  };

  var headerName = headerSubtypes[headerRecord.substring(2, 5)];
  if(headerName !== undefined) {
    var colonIndex = headerRecord.indexOf(':');
    if(colonIndex !== -1) {
      var headerValue = headerRecord.substring(colonIndex + 1);
      if(headerValue.length > 0 && /([^\s]+)/.test(headerValue)) {
        return {
          name: headerName,
          value: headerValue
        };
      }
    }
  }
}

function parseLatLong(latLongString) {
  var latitude = parseFloat(latLongString.substring(0, 2)) +
    parseFloat(latLongString.substring(2, 7)) / 60000.0;
  if(latLongString.charAt(7) === 'S') {
    latitude = -latitude;
  }

  var longitude = parseFloat(latLongString.substring(8, 11)) +
    parseFloat(latLongString.substring(11, 16)) / 60000.0;
  if(latLongString.charAt(16) === 'W') {
    longitude = -longitude;
  }

  return {
    lat: latitude,
    lng: longitude
  };
}

function parsePosition(positionRecord, model, readEnl) {
  // Regex to match position records:
  // Hours, minutes, seconds, latitude, N or S, longitude, E or W,
  // Fix validity ('A' = 3D fix, 'V' = 2D or no fix),
  // pressure altitude, GPS altitude.
  // Latitude and longitude are in degrees and minutes, with the minutes
  // value multiplied by 1000 so that no decimal point is needed.
  //                      hours    minutes  seconds  latitude    longitude        press alt  gps alt
  var positionRegex = /^B([\d]{2})([\d]{2})([\d]{2})([\d]{7}[NS][\d]{8}[EW])([AV])([-\d][\d]{4})([-\d][\d]{4})/;
  var positionMatch = positionRecord.match(positionRegex);
  var noiseLevel;

  if(positionMatch) {
    //position.Time holds number of seconds since UTC midnight.
    var positionTime = 3600 * parseInt(positionMatch[1], 10) + 60 * parseInt(positionMatch[2], 10) + parseInt(positionMatch[3], 10);
    if(model.recordTime.length > 0 && model.recordTime[0] > positionTime) {
      positionTime += 86400;
    }
    if(readEnl !== null) {
      noiseLevel = parseInt(positionRecord.substring(readEnl.start, readEnl.end));
    } else {
      noiseLevel = 0;
    }
    var position = parseLatLong(positionMatch[4]);
    if((position.lat !== 0) && (position.lng !== 0)) {
      return {
        recordTime: positionTime,
        latLong: position,
        quality: positionMatch[5],
        pressureAltitude: parseInt(positionMatch[6], 10),
        gpsAltitude: parseInt(positionMatch[7], 10),
        noise: noiseLevel
      };
    }

    /*
            // Convert the time to a date and time. Start by making a clone of the date
            // object that represents the date given in the headers:
            var positionTime = new Date(flightDate.getTime());
            positionTime.setUTCHours(parseInt(positionMatch[1], 10), parseInt(positionMatch[2], 10), parseInt(positionMatch[3], 10));
            // If the flight crosses midnight (UTC) then we now have a time that is 24 hours out.
            // We know that this is the case if the time is earlier than the first position fix.
            if (model.recordTime.length > 0 &&
                model.recordTime[0] > positionTime) {
                positionTime.setDate(flightDate.getDate() + 1);
            }
            if(readEnl !==null) {
                noiseLevel=parseInt(positionRecord.substring(readEnl.start,readEnl.end));
            }
            else {
                noiseLevel=0;
            }
           var  position=parseLatLong(positionMatch[4]);
         if((position.lat !==0) && (position.lng !==0)) {
            if(position.lat > model.bounds.north) {
               model.bounds.north=position.lat;
            }
             if(position.lat < model.bounds.south) {
                model.bounds.south=position.lat;
           }
             if(position.lng > model.bounds.east) {
                model.bounds.east=position.lng;
            }
             if(position.lng < model.bounds.west) {
                model.bounds.west=position.lng;
            }
            return {
                recordTime: positionTime,
                latLong:  position,
                pressureAltitude: parseInt(positionMatch[6], 10),
                gpsAltitude: parseInt(positionMatch[7], 10),
                noise: noiseLevel
            };
         }
         */
  }
}

//Parsing function starts here
function parseIGC(igcFile) {
  'use strict';
  var igcLines = igcFile.split('\n');
  if(igcLines.length < 2) {
    throw new IGCException("Not an IGC file");
  }
  // The first line should begin with 'A' followed by
  // a 3-character manufacturer Id and a 3-character serial number.
  if(!(/^A[\w]{6}/)
    .test(igcLines[0])) {
    throw new IGCException("Not an IGC file");
  }

  var model = {
    headers: [],
    recordTime: [],
    latLong: [],
    pressureAltitude: [],
    gpsAltitude: [],
    taskpoints: [],
    enl: [],
    fixQuality: [],
    flightDate: 0,
    takeOffIndex: 0,
    landingIndex: 0,
    takeOffPressure: 0,
    takeOffGps: 0,
    hasPressure: false,
    timeInterval: 0,
    bounds: {
      south: 90,
      west: 180,
      north: -90,
      east: -180
    }
  };

  var manufacturerInfo = parseManufacturer(igcLines[0]);
  model.headers.push({
    name: 'Logger manufacturer',
    value: manufacturerInfo.manufacturer
  });

  model.headers.push({
    name: 'Logger serial number',
    value: manufacturerInfo.serial
  });
  model.flightDate = extractDate(igcFile);
  var lineIndex;
  var positionData;
  var recordType;
  var currentLine;
  var headerData;
  var readEnl = null;
  var taskRegex = /^C[\d]{7}[NS][\d]{8}[EW].*/;
  for(lineIndex = 0; lineIndex < igcLines.length; lineIndex++) {
    currentLine = igcLines[lineIndex];
    recordType = currentLine.charAt(0);
    switch(recordType) {
    case 'B': // Position fix
      positionData = parsePosition(currentLine, model, readEnl);
      if(positionData) {
        model.recordTime.push(positionData.recordTime);
        model.latLong.push(positionData.latLong);
        model.pressureAltitude.push(positionData.pressureAltitude);
        model.gpsAltitude.push(positionData.gpsAltitude);
        model.enl.push(positionData.noise);
        model.fixQuality.push(positionData.quality);
        if(positionData.pressureAltitude > 0) {
          model.hasPressure = true;
        }
        if(positionData.latLong.lat > model.bounds.north) {
          model.bounds.north = positionData.latLong.lat;
        }
        if(positionData.latLong.lat < model.bounds.south) {
          model.bounds.south = positionData.latLong.lat;
        }
        if(positionData.latLong.lng > model.bounds.east) {
          model.bounds.east = positionData.latLong.lng;
        }
        if(positionData.latLong.lng < model.bounds.west) {
          model.bounds.west = positionData.latLong.lng;
        }
      }
      break;
    case 'I': //Fix extensions
      readEnl = getReadEnl(currentLine);
      break;
    case 'C': // Task declaration
      if(taskRegex.test(currentLine)) {
        // drop the "C" and push raw data to model.  Will parse later if needed using same functions as for user entered tasks
        model.taskpoints.push(currentLine.substring(1)
          .trim());
      }
      break;
    case 'H': // Header information
      headerData = parseHeader(currentLine);
      if(headerData) {
        model.headers.push(headerData);
      }
      break;
    }
  }
  model.timeInterval = (model.recordTime[model.recordTime.length - 1] - model.recordTime[0]) / model.recordTime.length;
  var i = 1;
  var j = model.recordTime.length - 1;
  var cuSum = 0;
  if(model.hasPressure) {
    i = 1;
    do {
      cuSum = cuSum + model.pressureAltitude[i] - model.pressureAltitude[i - 1];
      i++;
    }
    while ((cuSum < 4) && (i < model.recordTime.length));
    cuSum = 0;
    do {
      cuSum = cuSum + model.pressureAltitude[j - 1] - model.pressureAltitude[j];
      j--;
    }
    while ((cuSum < 4) && (j > 1));
  } else {
    do {
      i++;
    }
    while ((model.fixQuality[i] !== 'A') && (i < model.recordTime.length));
    do {
      cuSum = cuSum + model.gpsAltitude[i] - model.gpsAltitude[i - 1];
      i++;
    }
    while ((cuSum < 4) && (i < model.recordTime.length));
    do {
      j--;
    }
    while ((model.fixQuality[j] !== 'A') && (j > 2));
    cuSum = 0;
    do {
      cuSum = cuSum + model.gpsAltitude[j - 1] - model.gpsAltitude[j];
      j--;
    }
    while ((cuSum < 4) && (j > 1));
  }
  model.takeOffIndex = i - 1;
  model.landingIndex = j;
  return model;
}
