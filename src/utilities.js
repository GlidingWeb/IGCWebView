//Contains general purpose calculations- not necessarily exclusive to this application

var EARTHRAD = 6378; //  Earth radius km

function pad(n) {
  return(n < 10) ? ("0" + n.toString()) : n.toString();
}

module.exports ={
  showFormat: function(coords) {
  var latdegrees = Math.abs(coords['lat']);
  var latdegreepart = Math.floor(latdegrees);
  var latminutepart = 60 * (latdegrees - latdegreepart);
  var latdir = (coords['lat'] > 0) ? "N" : "S";
  var lngdegrees = Math.abs(coords['lng']);
  var lngdegreepart = Math.floor(lngdegrees);
  var lngminutepart = 60 * (lngdegrees - lngdegreepart);
  var lngdir = (coords['lng'] > 0) ? "E" : "W";
  return retstr = latdegreepart.toString() + "&deg;" + latminutepart.toFixed(3) + "&prime;" + latdir + " " + lngdegreepart.toString() + "&deg;" + lngminutepart.toFixed(3) + "&prime;" + lngdir;
   },
   
showDate: function(timestamp) {
     var daynames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var monthnames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var localdate = new Date(1000 * timestamp);
       return daynames[localdate.getUTCDay()] + " " + localdate.getUTCDate() + " " + monthnames[localdate.getUTCMonth()] + " " + localdate.getUTCFullYear();
    },
   
getTimeZone: function(start,coords) {
    return $.ajax({
      url: "gettimezone.php",
      data: {
        recstart: start,
        lat: coords.lat,
        lon: coords.lng
      },
      timeout: 3000,
      method: "POST",
      dataType: "json"
    });
},
  
getElevation: function(coords) {
    return $.ajax({
      url: "getelevation.php",
      data: {
        lat: coords.lat,
        lon: coords.lng
      },
      timeout: 3000,
      method: "POST",
      dataType: "json"
    });
},

   getAirspace: function(bounds, margin) {
    return $.ajax({
      url: "getairspace.php",
      data: {
         bounds: JSON.stringify(bounds),
        margin: margin
      },
      timeout: 3000,
      method: "POST",
      dataType: "json"
    });
},
   
getUnixTime: function (hhmmss) {                  //Once the date is displayed we are just tracking offset from midnight
            var utime=3600*parseInt(hhmmss.substr(0,2)) + 60*parseInt(hhmmss.substr(2,2)) + parseInt(hhmmss.substr(4,2));
            return utime;
        },
       
       parseLatLong: function(latLongString) {
        var latitude = parseFloat(latLongString.substring(0, 2)) +
            parseFloat(latLongString.substring(2, 7)) / 60000.0;
        if (latLongString.charAt(7) === 'S') {
            latitude = -latitude;
        }
        var longitude = parseFloat(latLongString.substring(8, 11)) +
            parseFloat(latLongString.substring(11, 16)) / 60000.0;
        if (latLongString.charAt(16) === 'W') {
            longitude = -longitude;
        }

        return {
                        lat: latitude, 
                        lng: longitude
           };
     },
 
 getUnixDate: function(ddmmyy) {
    var day = parseInt(ddmmyy.substr(0,2), 10);
  var month = parseInt(ddmmyy.substr(2,2), 10) - 1;
  // The IGC specification has a built-in Millennium Bug (2-digit year).
  // I will arbitrarily assume that any year before "80" is in the 21st century.
  var year =parseInt(ddmmyy.substr(4,2), 10);
  if(year < 80) {
    year += 2000;
  } else {
    year += 1900;
  }
  var jsdate = new Date(Date.UTC(year, month, day));      //This is the only time we use the Date object- easiest way to get day of the week.
  return jsdate.getTime() / 1000;
},
     
unixToString: function(timestamp) {
    return pad(Math.floor(timestamp / 3600)) + ":" + pad(Math.floor((timestamp/ 60) % 60)) + ":" + pad(timestamp % 60);
},

toPoint: function(start,end) {
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
},
targetPoint: function(start, distance, bearing) {
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
}

