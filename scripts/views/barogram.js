(function () {
    'use strict';

    var eventTypes = require('../eventTypes.js');
    var moment = require('moment');

    var barogram;

    function setCrossHair(presenter) {
        var pos = presenter.getCurrentPosition();
                   barogram.lockCrosshair({
                        x: pos.timeOfMeasurement.valueOf(),
                        y: pos.pressureAltitude
                   }); 
     }

    function plotBarogram(presenter) {
        var timeZoneSettings = presenter.getTimeZoneSettings();
        var offset = timeZoneSettings.offsetMinutes;
        
        // X values are times converted to milliseconds since 01/01/1970.
        var timeValues = presenter.getTimeValues().map(function (t) { return t.valueOf(); });
        var altitudes = presenter.getAltitudeValues();
        var altitudeUnit = presenter.getAltitudeUnit();

        var pressureBarogramData = [], gpsBarogramData = [];
        timeValues.forEach(function (t, index) {
            pressureBarogramData.push([t, altitudes.pressure[index]]);
            gpsBarogramData.push([t, altitudes.gps[index]]);
        });
        
        // Reveal the map and graph. We have to do this before
        // setting the zoom level of the map or plotting the graph.
        $('#igcFileDisplay').show();
        
        barogram = $.plot($('#barogram'), [{
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
                axisLabel: 'Time (' + timeZoneSettings.name + ')',
                tickFormatter: function (t, axis) {
                     return moment(t).utcOffset(offset).format('HH:mm');
                },
                ticks: function (axis) {
                    var ticks = [];
                    var startMoment = moment(axis.min).utcOffset(offset);
                    var endMoment = moment(axis.max).utcOffset(offset);
                    var durationMinutes = endMoment.diff(startMoment, 'minutes');
                    var interval;
                    if (durationMinutes <= 10) {
                       interval = 1;
                    }
                    if (durationMinutes <= 50) {
                       interval = 5;
                    }
                    else if (durationMinutes <= 100) {
                       interval = 10;
                    }
                    else if (durationMinutes <= 150) {
                       interval = 15;
                    }
                    else if (durationMinutes <= 300) {
                       interval = 30;
                    }
                    else if (durationMinutes <= 600) {
                       interval = 60;
                    }
                    else {
                       interval = 120;
                    }
                    
                    var tick = startMoment.clone();
                    tick.minutes(0).seconds(0);
                    while (tick < endMoment) {
                        if (tick > startMoment) {
                            ticks.push(tick.valueOf());
                        }
                        tick.add(interval, 'minutes');
                    }
                    
                    return ticks;
                }
            },
            yaxis: {
                axisLabel: 'Altitude / ' + altitudeUnit
            },
            
            crosshair: {
                mode: 'xy'
            },
            
            grid: {
                clickable: true,
                autoHighlight: false
            }
        });
        
        setCrossHair(presenter);
    }

    module.exports = {
        setup: function (presenter) {
            presenter.on(eventTypes.igcLoaded, function (igcFile) {
                if (presenter.isFileLoaded()) {
                    plotBarogram(presenter);
                }
            });

            presenter.on(eventTypes.altitudeUnitChanged, function (unit) {
                if (presenter.isFileLoaded()) {
                    plotBarogram(presenter);
                }
            });

            presenter.on(eventTypes.timeIndexChanged, function (data) {
                var pos = presenter.getCurrentPosition();
                barogram.lockCrosshair({
                    x: pos.timeOfMeasurement.valueOf(),
                    y: pos.pressureAltitude
                });
            });

            $('#barogram').on('plotclick', function (event, pos, item) {
                if (item) {
                    presenter.setTimeIndex(item.dataIndex, 'barogram');
                }
            });
        }
    };
} ());