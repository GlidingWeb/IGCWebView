//Most of this is still to be written
//It sets up user display preferences and also handles unit conversion since
//all internal records and calculations are in metres

 var METRE2FOOT = 3.2808399;
var altitude= {
        source: 'P',
        units: 'ft',
        reference: 'QFE'
    };
  
  
module.exports={
    airclip: 6001,
    tasksource: 'igc',
    distance: 'km',
    sectors: {
       startrad: 5, //start line radius
        finrad: 1, //finish line radius
        tprad:  0.5, //'beer can' radius
        sector_rad: 20, //tp sector radius
        sector_angle: 90, //tp sector
        use_sector:  true,
       use_barrel:  true,
      finishtype:  "line"
    },
    altitude: altitude,
    metre2foot: METRE2FOOT,
    
     showAltitude: function (pressureAlt,gpsAlt,afElevation,toPressure,toGps) {
        var takeoff;
        var source;
        var multiplier;
        if(altitude.source==='P') {
            showalt=pressureAlt;
            takeoff=toPressure;
            source= " (baro) ";
        }
        else {
            showalt=gpsAlt;
            takeoff=toGps;
            source= " (GPS) ";
        }
        switch(altitude.reference) {
            case 'QFE' :
                showalt-=takeoff;
                break;
            case 'QNH' :
                showalt=showalt-takeoff + afElevation;
                break;
        }
        if(altitude.units==='ft') {
            multiplier=METRE2FOOT;
            descriptor=" feet ";
        }
        else {
            descriptor=" metres ";
            multiplier=1;
        }
        showalt=Math.round(showalt*multiplier);
        return  {
                        displaySentence: altitude.reference  + source + showalt + descriptor,
                        altPos: showalt
        };
    }
} 