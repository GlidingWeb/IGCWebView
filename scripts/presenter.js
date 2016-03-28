(function () {
    'use strict';

    var moment = require('moment');
    var eventTypes = require('./eventTypes.js');
    var parser = require('./model/parseigc.js');
    var timezone = require('./model/timezone.js');
    
    var listeners = [];
    
    var igcFile = {};
    
    var timeZoneSettings = {
        name: 'UTC',
        abbreviation: 'UTC',
        offsetMinutes: 0
    };
    
    var isFileLoaded = false;
    
    // Altitudes converted to feet or metres as appropriate
    var pressureAltitude = [], gpsAltitude = [];
    var altitudeUnit = 'metres';

    var timeIndex = 0;

    // Publish an event
    function trigger(topic, data) {
        if (listeners[topic] && listeners[topic].length > 0) {
            listeners[topic].forEach(function (listener) {
                listener(data || {});
            });
        }
    }

    function setAltitudeUnit(unit) {
        var conversion = (unit === 'feet') ? 3.2808399 : 1.0;
        altitudeUnit = unit;

        if (igcFile.pressureAltitude) {
            pressureAltitude = igcFile.pressureAltitude.map(function (alt) {
                return alt * conversion;
            });
        }
        else {
            pressureAltitude = [];
        }

        if (igcFile.gpsAltitude) {
            gpsAltitude = igcFile.gpsAltitude.map(function (alt) {
                return alt * conversion;
            });
        }
        else {
            gpsAltitude = [];
        }

        trigger(eventTypes.altitudeUnitChanged, unit);
    };
    
    // Sets the index value for the time slider.
    // Parameters:
    // t: The time index value (integer)
    // source: String identifying the control which triggered
    //         the event. This enables controls to ignore events
    //         which they themselves caused.
    function setTimeIndex(t, source) {
        timeIndex = t;
        trigger(eventTypes.timeIndexChanged, { timeIndex: timeIndex, source: source });
    }

    module.exports = {
        getAltitudeUnit: function () {
            return altitudeUnit;
        },
        
        getAltitudeValues: function() {
            return {
                pressure: pressureAltitude,
                gps: gpsAltitude
            };
        },
        
        // Gets the time, latitude, longitude and altitude
        // of the currently selected point in the logger trace.
        getCurrentPosition: function () {
            if (igcFile.latLong && igcFile.latLong.length > 0) {
                return {
                    latitude: igcFile.latLong[timeIndex][0],
                    longitude: igcFile.latLong[timeIndex][1],
                    pressureAltitude: pressureAltitude[timeIndex],
                    gpsAltitude: gpsAltitude[timeIndex],
                    timeOfMeasurement: igcFile.localTime[timeIndex],
                    timeZoneAbbreviation: timezone.abbreviation()
                };
            }
            
            // If no file loaded, return safe defaults.
            return {
                latitude: 0,
                longitude: 0,
                pressureAltitude: 0,
                gpsAltitude: 0,
                timeOfMeasurement: moment().utc(),
                timeZoneAbbreviation: 'UTC'
            };
        },
        
        getTimeValues: function() {
            return igcFile.localTime;
        },
        
        getTimeZoneSettings: function() {
            return timeZoneSettings;
        },
        
        isFileLoaded: function() {
            return isFileLoaded;
        },

        loadFile: function (igc) {
            try {
                igcFile = parser.parseIGC(igc);
                
                // Convert times from UTC to time zone of the country where
                // the flight took place.
                timezone.detectTimeZone(
                    igcFile.latLong[0],
                    igcFile.recordTime[0],
                    function (tz) {
                        // Convert time offset from milliseconds to minutes.
                        timeZoneSettings = {
                            name: tz.zonename,
                            abbreviation: tz.zoneabbr,
                            offsetMinutes: tz.offset / 60.0e3
                        };
                        
                        igcFile.localTime = igcFile.recordTime.map(function (t) {
                            return moment(t).utcOffset(timeZoneSettings.offsetMinutes);
                        });
                        
                        // Convert altitudes to feet if required.
                        setAltitudeUnit(altitudeUnit);
                        isFileLoaded = true;
                        trigger(eventTypes.igcLoaded, igcFile);
                        setTimeIndex(0, 'presenter');
                    });
            }
            catch (ex) {
                if (ex instanceof parser.IGCException) {
                    trigger(eventTypes.error, ex.message);
                }
                else {
                    throw ex;
                }
            }
        },

        on: function (topic, listener) {
            /// Subscribes to an event.
            // Parameters:
            // topic: The type of event
            // listener: Function to be called when the event happens.
            
            // Create topic if it doesn't already exist
            if (!listeners[topic]) {
                listeners[topic] = [];
            }

            listeners[topic].push(listener);
        },

        setTimeIndex: setTimeIndex,

        setAltitudeUnit: setAltitudeUnit
    }
} ());