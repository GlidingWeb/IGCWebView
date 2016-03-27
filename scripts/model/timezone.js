(function () {
    'use strict';

    var timezone = {
        zonename: "UTC",
        zoneabbr: "UTC",
        offset: 0,
        dst: false
    };
    
    module.exports = {
        //get timezone data from timezonedb.  Via php to avoid cross-domain data request from the browser
        //Timezone dependent processes run  on file load are here as request is asynchronous
        //If the request fails or times out, silently reverts to default (UTC)
        detectTimeZone: function (latLong, flightDate, callback) {

            $.ajax({
                url: "gettimezone.php",
                data: {
                    stamp: flightDate.valueOf() / 1000.0, // Seconds since 01 January 1970
                    lat: latLong[0],
                    lon: latLong[1]
                },
                timeout: 3000,
                method: "POST",
                dataType: "json",
                success: function (data) {
                    if (data.status === "OK") {
                        timezone.zonename = data.zoneName;
                        timezone.zoneabbr = data.abbreviation;
                        timezone.offset = 1000 * parseFloat(data.gmtOffset);
                        if (data.dst === "1") {
                            timezone.zonename += ", daylight saving";
                        }
                    }
                },
                complete: function () {
                    callback(timezone);
                }
            });
        },
        
        name: function() {
            return timezone.zonename;
        }
    };
} ());