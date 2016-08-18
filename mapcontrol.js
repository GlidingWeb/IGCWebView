var mapControl;
function initMap() {
 mapControl = createMapControl();
}

function createMapControl() { 
   var taskfeatures = [];
   var sectorfeatures=[];
   var trackline;
   var airspacePolygons=[];
  var polygonBases = [];
   var airspaceCircles=[];
    var circleBases = [];
    var engineLines=[];
   
   var gliderMarker = new google.maps.Marker({
    icon: 'glidericon.png'
  });
   
var myStyles =[ 
     {
         "featureType": "poi", 
         "elementType": "labels", 
         "stylers": [
         { "visibility": "off" } 
        ] 
    },
         { 
         "featureType": "transit", 
         "elementType": "labels", 
          "stylers": [
          { "visibility": "off" }
        ] } ];
     
    var mapOpt = {
      center: new google.maps.LatLng(0, 0),
      zoom: 2,
      mapTypeId: google.maps.MapTypeId.TERRAIN,
      streetViewControl: false,
      styles: myStyles
    };
    
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
    
function getLineBounds(line) {
  var bounds = new google.maps.LatLngBounds();
  line.getPath().forEach(function(latLng) {
    bounds.extend(latLng);
  });
  return bounds;
}
    
function getTargetLine(start, end) {
      var targetLine = new google.maps.Polyline({
        path: [start, end],
        strokeColor: 'black',
        strokeOpacity: 1.0,
        strokeWeight: 2
      });
  return targetLine;
    }
    
    function getCircle(centre,radius) {
        var tpCircle = new google.maps.Circle({
        strokeColor: 'black',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: 'green',
        fillOpacity: 0.1,
        center: centre,
        radius: radius * 1000
      });
        return tpCircle;
    }

    function getPolygon(coordlist) {
         var sectorPoly = new google.maps.Polygon({
        paths: coordlist,
        strokeColor: 'black',
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: 'green',
        fillOpacity: 0.1
      });
         return sectorPoly;
    }
    
     function zapSectors() {
        var i;
        for(i=0;i < sectorfeatures.length; i++) {
           sectorfeatures[i].setMap(null);
        }
        sectorfeatures=[];
    }
    
    function zapTask() {
        var i;
        zapSectors();
        for(i=0;i < taskfeatures.length; i++) {
            taskfeatures[i].setMap(null);
        }
        taskfeatures=[];
    }
    
     function deleteEnl () {
      var i;
      for(i=0;i < engineLines.length;i++) {
          engineLines[i].setMap(null);
      }
      engineLines=[];
  }
  
  map = new google.maps.Map($('#map').get(0), mapOpt);
  
return {
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
      var taskbounds=getLineBounds(route);
      map.fitBounds(taskbounds);
    },
    
    drawSectors: function(sectorList) {
        var i;
        var feature;
        zapSectors();
        for(i=0;i< sectorList.length;i++) {
            switch(sectorList[i].type) {
                case "line":
                 feature=getTargetLine(sectorList[i].start,sectorList[i].end);
                  break;
                case "circle":
                     feature=getCircle(sectorList[i].centre,sectorList[i].radius);
                    break;
                case "segment":
                    feature=getPolygon(sectorList[i].outline);
                    break;
            }
           feature.setMap(map);
           sectorfeatures.push(feature);
        }
    },
    
    clearTask: function() {
        zapTask();
    },
    
    setBounds: function(bounds) {
        map.fitBounds(bounds);
    },
    
  showTP:  function(tpoint) {
   map.panTo(tpoint);
    map.setZoom(13);
    },
    
addTrack:  function(coords) {
    pin.setMap(null);
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

  zapEngineRuns: function() {
        deleteEnl();
    },   
    
showEngineRuns: function(runList) {
    var i;
     var lineOpt={
         strokeColor: 'yellow',
        strokeOpacity: 1.0,
        clickable: false,
        zIndex: google.maps.Marker.MAX_ZINDEX +1,
        strokeWeight: 4
     };
        deleteEnl();
    for(i=0;i < runList.length; i++) {
        engineLines[i]= new google.maps.Polyline(lineOpt);
       engineLines[i].setPath(runList[i]);
       engineLines[i].setMap(map);
    }
},
    
setTimeMarker:  function(position) {
      gliderMarker.setPosition(position);
     var gliderpos = new google.maps.LatLng(position);
      if (!(map.getBounds().contains(gliderpos))) {
       map.panTo(gliderpos);
      }
},
 pushPin: function(coords) {
      pin.setPosition(coords);
      pin.setMap(map);
    }
};
}


