// When an IGC file is loaded, display the header information
// (pilot name, glider registration etc.) in a table.
(function () {
    'use strict';
    
    var eventTypes = require('../eventTypes.js');

    module.exports = {
        setup: function (presenter) {
            presenter.on(eventTypes.igcLoaded, function (igc) {
                var headerTable = $('#headerInfo');
                
                headerTable.html('');
                if (igc.headers) {
                    igc.headers.forEach(function (header) {
                        headerTable.append(
                            $('<tr></tr>')
                                .append($('<th></th>').text(header.name))
                                .append($('<td></td>').text(header.value))
                            );
                    });
                }
                
                $('#flightInfo').show();
            });
        }
    };
} ());