// This is the entry point for the build.  Contains basic user interaction code.

var present=require('./presentation');
window.ginit=function(){                            //Callback after maps api loads.  Must be in global scope
    var map=require('./mapctrl');
      map.initmap();
}

var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://maps.googleapis.com/maps/api/js?v=3&callback=ginit';
  document.body.appendChild(script);

 $('#fileControl').change(function() {

     if (this.files.length > 0) {
            var reader = new FileReader();
            reader.onload = function (e) {
            //  try {                                                                //exception handling temporarily disabled till debugged
                var igcFile=require('./igc');
                 igcFile.initialise(this.result);
                present.displayIgc();
              /*  
              } catch (ex) {
                if (ex instanceof IGCException) {
                  alert(ex.message);
                } else {
                  throw ex;
                }
              }
       */       
            };
            reader.readAsText(this.files[0]);
          }
    });
      

 
        $('#timeSlider').on('input', function () {
          var t = parseInt($(this).val(), 10);
           present.showPosition(t);
        });

      $('#timeSlider').on('change', function () {
          var t = parseInt($(this).val(), 10);
          present.showPosition(t);
        });

     $('#zoomtrack').click(function () {
          present.zoomTrack();
        });
     
      $('#help').click(function () {
          alert( "You are running jQuery version: " + $.fn.jquery );
        });