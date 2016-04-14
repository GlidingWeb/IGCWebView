function createMapControl() {
  var myStyles = [
  {
    "featureType": "poi",
    "elementType": "labels",
    "stylers": [
    {
      "visibility": "off"
    }]
  },
  {
    "featureType": "transit",
    "elementType": "labels",
    "stylers": [
    {
      "visibility": "off"
    }]
  }];
  var mapOpt = {
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    streetViewControl: false,
    styles: myStyles
  };

  var map = new google.maps.Map($('#map').get(0), mapOpt);
  var taskfeatures = [];
  var airspacePolygons = [];
  var polygonBases = [];
  var airspaceCircles = [];
  var circleBases = [];
  var gliderMarker = new google.maps.Marker({
    icon: 'glidericon.png'
  });
  var trackline;
  var trackbounds;
  var engineLines=[];

  var pinicon = {
    url: 'pin.png',
    anchor: new google.maps.Point(0, 53)
  };

  var pin = new google.maps.Marker({
    icon: pinicon
  });

  function zapAirspace() {
    var i;
    var j;
    for (i = 0; i < airspacePolygons.length; i++) {
      airspacePolygons[i].setMap(null);
      airspacePolygons[i] = null;
    }
    airspacePolygons.length = 0;
    polygonBases.length = 0;
    for (j = 0; j < airspaceCircles.length; j++) {
      airspaceCircles[j].setMap(null);
      airspaceCircles[j] = null;
    }
    airspaceCircles.length = 0;
    circleBases.length = 0;
  }

  function deleteEnl () {
      var i;
      for(i=0;i < engineLines.length;i++) {
          engineLines[i].setMap(null);
      }
      engineLines=[];
  }
  
  function deleteTask() {
    var i;
    for (i = 0; i < taskfeatures.length; i++) {
      taskfeatures[i].setMap(null);
    }
    taskfeatures.length = 0;
  }

  return {
    reset: function() {
      // Clear any existing track data so that a new file can be loaded.
      if (trackline) {
        trackline.setMap(null);
      }
      deleteTask();
      deleteEnl();
      pin.setMap(null);
    },

    zapTask: function() {
      deleteTask();
    },

    addTask: function(task) {
      var j;
      var route = new google.maps.Polyline({
        path: task.coords,
        strokeColor: 'dimgray',
        strokeOpacity: 1.0,
        strokeWeight: 3
      });
      route.setMap(map);
      taskfeatures.push(route);
      for (j = 0; j < task.coords.length - 1; j++) {
        var taskmarker = new google.maps.Marker({
          position: task.coords[j],
          map: map,
          title: task.labels[j]
        });
        taskfeatures.push(taskmarker);
      }
    },
    drawTargetLine: function(start, end) {
      var targetLine = new google.maps.Polyline({
        path: [start, end],
        strokeColor: 'black',
        strokeOpacity: 1.0,
        strokeWeight: 2
      });
      targetLine.setMap(map);
      taskfeatures.push(targetLine);
    },

    drawTpCircle: function(point, radius) {
      var tpCircle = new google.maps.Circle({
        strokeColor: 'black',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: 'green',
        fillOpacity: 0.1,
        map: map,
        center: point,
        radius: radius * 1000
      });
      taskfeatures.push(tpCircle);
    },

    drawTpSector: function(pointlist) {
      var sectorPoly = new google.maps.Polygon({
        paths: pointlist,
        strokeColor: 'black',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: 'green',
        fillOpacity: 0.1
      });
      sectorPoly.setMap(map);
      taskfeatures.push(sectorPoly);
    },

    addTrack: function(coords) {
      if (trackline) {
        trackline.setMap(null);
      }
      trackline = new google.maps.Polyline({
        path: coords,
        strokeColor: 'blue',
        strokeOpacity: 1.0,
        clickable: false,
        strokeWeight: 4
      });
      trackline.setMap(map);
      trackbounds = new google.maps.LatLngBounds();
      var i;
      var points = trackline.getPath().getArray();
      for (i = 0; i < points.length; i++) {
        trackbounds.extend(points[i]);
      }
      gliderMarker.setPosition(coords[0]);
      gliderMarker.setMap(map);
    },

    updateAirspace: function(clipalt) {
      var i;
      var j;
      for (i = 0; i < airspacePolygons.length; i++) {
        if (polygonBases[i] < clipalt) {
          airspacePolygons[i].setMap(map);
        } else {
          airspacePolygons[i].setMap(null);
        }
      }
      for (j = 0; j < airspaceCircles.length; j++) {
        if (circleBases[j] < clipalt) {
          airspaceCircles[j].setMap(map);
        } else {
          airspaceCircles[j].setMap(null);
        }
      }
    },

    setAirspace: function(airdata) {
      var i;
      var j;
      zapAirspace();
      var airDrawOptions = {
        strokeColor: 'black',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: '#FF0000',
        fillOpacity: 0.2,
        clickable: false
      };
      for (i = 0; i < airdata.polygons.length; i++) {
        airspacePolygons[i] = new google.maps.Polygon(airDrawOptions);
        airspacePolygons[i].setPaths(airdata.polygons[i].coords);
        polygonBases[i] = airdata.polygons[i].base;
      }
      for (j = 0; j < airdata.circles.length; j++) {
        airspaceCircles[j] = new google.maps.Circle(airDrawOptions);
        airspaceCircles[j].setRadius(1000 * airdata.circles[j].radius);
        airspaceCircles[j].setCenter(airdata.circles[j].centre);
        circleBases[j] = airdata.circles[j].base;
      }
    },

    setTimeMarker: function(position) {
      gliderMarker.setPosition(position);
      var gliderpos = new google.maps.LatLng(position);
      if (!(map.getBounds().contains(gliderpos))) {
        map.panTo(gliderpos);
      }
    },

    showTP: function(tpoint) {
      map.panTo(tpoint);
      map.setZoom(13);
    },

    zoomToTrack: function() {
      map.fitBounds(trackbounds);
    },

    showRuns: function(coords) {
       var runline = new google.maps.Polyline({
        path: coords,
        strokeColor: 'yellow',
        strokeOpacity: 1.0,
        clickable: false,
        strokeWeight: 4
      }); 
       runline.setMap(map);
       engineLines.push(runline);
    },
    
    zapEngineRuns: function() {
        deleteEnl();
    },
    
    setBounds: function(bounds) {
      var sw = new google.maps.LatLng(bounds.south, bounds.west);
      var ne = new google.maps.LatLng(bounds.north, bounds.east);
      trackbounds = new google.maps.LatLngBounds(sw, ne);
      map.fitBounds(trackbounds);
      var retval = trackbounds.getCenter();
      return {
        lat: retval.lat(),
        lng: retval.lng()
      };
    },

    pushPin: function(coords) {
      pin.setPosition(coords);
      pin.setMap(map);
    }
  };
}
