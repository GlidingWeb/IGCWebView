// Wrapper for the leaflet.js map control with methods
// to manage the map layers.
function createMapControl(elementName) {
  'use strict';

  // Private methods for drawing turn point sectors and start / finish lines

  function getBearing(pt1, pt2) {
    // Get bearing from pt1 to pt2 in degrees
    // Formula from: http://www.movable-type.co.uk/scripts/latlong.html
    // Start by converting to radians.
    var degToRad = Math.PI / 180.0;
    var lat1 = pt1['lat'] * degToRad;
    var lon1 = pt1['lng'] * degToRad;
    var lat2 = pt2['lat'] * degToRad;
    var lon2 = pt2['lng'] * degToRad;

    var y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

    var bearing = Math.atan2(y, x) / degToRad;
    bearing = (bearing + 360.0) % 360.0;
    return bearing;
  }

  function getLine(pt1, pt2, linerad, drawOptions) {
    //returns line through pt1, at right angles to line between pt1 and pt2, length linerad.
    //Use Pythogoras- accurate enough on this scale
    var latdiff = pt2['lat'] - pt1['lat'];
    var northmean = (pt1['lat'] + pt2['lat']) * Math.PI / 360;
    var startrads = pt1['lat'] * Math.PI / 180;
    var longdiff = (pt1['lng'] - pt2['lng']) * Math.cos(northmean);
    var hypotenuse = Math.sqrt(latdiff * latdiff + longdiff * longdiff);
    //assume earth is a sphere circumference 40030 Km 
    var latdelta = linerad * longdiff / hypotenuse / 111.1949269;
    var longdelta = linerad * latdiff / hypotenuse / 111.1949269 / Math.cos(startrads);
    var linestart = L.latLng(pt1['lat'] - latdelta, pt1['lng'] - longdelta);
    var lineend = L.latLng(pt1['lat'] + latdelta, longdelta + pt1['lng']);
    var polylinePoints = [linestart, lineend];
    return L.polyline(polylinePoints, drawOptions);
  }

  function getTpSector(centrept, pt1, pt2, sectorRadius, sectorAngle, drawOptions) {
    var headingIn = getBearing(pt1, centrept);
    var bearingOut = getBearing(pt2, centrept);
    var bisector = headingIn + (bearingOut - headingIn) / 2;

    if (Math.abs(bearingOut - headingIn) > 180) {
      bisector = (bisector + 180) % 360;
    }

    var beginangle = bisector - sectorAngle / 2;

    if (beginangle < 0) {
      beginangle += 360;
    }

    var endangle = (bisector + sectorAngle / 2) % 360;
    var sectorOptions = jQuery.extend({}, drawOptions, {
      startAngle: beginangle,
      stopAngle: endangle
    });
    return L.circle(centrept, sectorRadius, sectorOptions);
  }

  function zapAirspace() {
    if (mapLayers.airspace) {
      map.removeLayer(mapLayers.airspace);
    }
  }

  function showAirspace() {
    var i;
    var polyPoints;
    var airStyle = {
      "color": "black",
      "weight": 1,
      "opacity": 0.20,
      "fillColor": "red",
      "smoothFactor": 1
    };
    var suafeatures = [];
    zapAirspace();
    if ((airClip > 0) && (map.getZoom() > 6)) {
      for (i = 0; i < airspace.polygons.length; i++) {
        if (airspace.polygons[i].base < airClip) {
          polyPoints = airspace.polygons[i].coords;
          suafeatures.push(L.polygon(polyPoints, airStyle));
        }
      }
      for (i = 0; i < airspace.circles.length; i++) {
        if (airspace.circles[i].base < airClip) {
          suafeatures.push(L.circle(airspace.circles[i].centre, 1000 * airspace.circles[i].radius, airStyle));
        }
      }
      mapLayers.airspace = L.layerGroup(suafeatures).addTo(map);
    }
  }

  // End of private methods

  var map = L.map(elementName);

  //Airspace clip altitude and initial bounds now a property of this object
  var airClip = 0;
  var pin;
  var initBounds;
  var airspace = {};

  var mapQuestAttribution = ' | Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">';
  var mapLayers = {
    openStreetMap: L.tileLayer('http://otile1.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpg', {
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>' +
        mapQuestAttribution,
      maxZoom: 18
    }),

    photo: L.tileLayer('http://otile1.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg', {
      attribution: 'Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency' +
        mapQuestAttribution,
      maxZoom: 11
    })
  };

  var layersControl = L.control.layers({
    'MapQuest OpenStreetMap': mapLayers.openStreetMap,
    'MapQuest Open Aerial (Photo)': mapLayers.photo
  });

  mapLayers.openStreetMap.addTo(map);
  layersControl.addTo(map);
  var trackLatLong = [];
  var timePositionMarker;
  L.AwesomeMarkers.Icon.prototype.options.prefix = 'fa';
  var planeIcon = L.AwesomeMarkers.icon({
    icon: 'plane',
    iconColor: 'white',
    markerColor: 'red'
  });
  return {
    reset: function() {
      // Clear any existing track data so that a new file can be loaded.
      if (mapLayers.track) {
        map.removeLayer(mapLayers.track);
        layersControl.removeLayer(mapLayers.track);
      }

      if (mapLayers.task) {
        map.removeLayer(mapLayers.task);
        layersControl.removeLayer(mapLayers.task);
      }
      if (pin) {
        map.removeLayer(pin);
      }
    },

    setAirspace: function(suadata) {
      airspace = suadata;
      showAirspace();
    },

    addTrack: function(latLong) {
      trackLatLong = latLong;
      var trackLine = L.polyline(latLong, {
        color: 'blue',
        weight: 4
      });
      timePositionMarker = L.marker(latLong[0], {
        icon: planeIcon
      });
      mapLayers.track = L.layerGroup([
        trackLine,
        timePositionMarker
      ]).addTo(map);
      layersControl.addOverlay(mapLayers.track, 'Flight path');
      initBounds = (trackLine.getBounds());
      map.fitBounds(initBounds);
    },

    zoomToTrack: function() {
      map.fitBounds(initBounds);
    },

    zapTask: function() {
      if (mapLayers.task) {
        map.removeLayer(mapLayers.task);
        layersControl.removeLayer(mapLayers.task);
      }
      if (pin) {
        map.removeLayer(pin);
      }
    },

    addTask: function(coordinates, names, sectordefs) {
      var taskLayers = [L.polyline(coordinates, {
        color: 'dimgray'
      })];
      var lineDrawOptions = {
        fillColor: 'green',
        color: 'black',
        weight: 2,
        opacity: 0.8
      };
      var sectorDrawOptions = {
        fillColor: 'green',
        fillOpacity: 0.1,
        color: 'black',
        weight: 1,
        opacity: 0.8
      };
      var j;
      for (j = 0; j < coordinates.length; j++) {
        taskLayers.push(L.marker(coordinates[j]).bindPopup(names[j]));
        switch (j) {
          case 0:
            var startline = getLine(coordinates[0], coordinates[1], sectordefs.startrad, lineDrawOptions);
            taskLayers.push(startline);
            break;
          case (coordinates.length - 1):
            if (sectordefs.finishtype === "line") {
              var finishline = getLine(coordinates[j], coordinates[j - 1], sectordefs.finrad, lineDrawOptions);
              taskLayers.push(finishline);
            }
            else {
              taskLayers.push(L.circle(coordinates[j], sectordefs.finrad * 1000, sectorDrawOptions));
            }
            break;
          default:
            if (sectordefs.use_barrel) {
              taskLayers.push(L.circle(coordinates[j], sectordefs.tprad * 1000, sectorDrawOptions));
            }
            if (sectordefs.use_sector) {
              var tpsector = getTpSector(coordinates[j], coordinates[j - 1], coordinates[j + 1], sectordefs.sector_rad * 1000, sectordefs.sector_angle, sectorDrawOptions);
              taskLayers.push(tpsector);
            }
        }
      }
      mapLayers.task = L.layerGroup(taskLayers).addTo(map);
      layersControl.addOverlay(mapLayers.task, 'Task');
    },

    updateAirspace: function(clip) {
      airClip = clip;
      showAirspace();
    },

    setClipAlt: function(clip) {
      airClip = clip;
    },

    showTP: function(tpoint) {
      map.setView(tpoint, 13);
    },

    pushPin: function(coords) {

      var pinIcon = L.icon({
        iconUrl: 'pin.png',
        iconSize: [33, 53], // size of the icon
        iconAnchor: [0, 50], // point of the icon which will correspond to marker's location
        popupAnchor: [-3, -76] // point from which the popup should open relative to the iconAnchor
      });
      if (pin) {
        map.removeLayer(pin);
      }
      pin = L.marker(L.latLng(coords), {
        icon: pinIcon
      }).addTo(map);
    },

    setTimeMarker: function(timeIndex) {
      var markerLatLng = trackLatLong[timeIndex];
      if (markerLatLng) {
        timePositionMarker.setLatLng(markerLatLng);

        if (!map.getBounds().contains(markerLatLng)) {
          map.panTo(markerLatLng);
        }
      }
    }
  };
}
