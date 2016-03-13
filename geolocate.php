<?php
$countries=array(
   'AUT'=>'at',
   'AUS'=>'au',
   'BEL'=>'be',
   'BRA'=>'br',
   'CAN'=>'ca',
   'CHE'=>'ch',
   'CZE'=>'cz',
   'DEU'=>'de',
   'EST'=>'ee',
   'ESP'=>'es',
   'FIN'=>'fi',
   'FRA'=>'fr',
   'HRV'=>'hr',
   'HUN'=>'hu',
   'IRL'=>'ie',
   'ITA'=>'it',
   'LTU'=>'lt',
   'LVA'=>'lv',
   'MKD'=>'mk',
   'NLD'=>'nl',
   'NOR'=>'no',
   'NZL'=>'nz',
   'POL'=>'pl',
   'PRT'=>'pt',
   'SWE'=>'se',
   'SVN'=>'si',
   'SVK'=>'sk',
   'GBR'=>'uk',
   'USA'=>'us',
   'ZAF'=>'za',
    );
$ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://search.mapzen.com/v1/reverse?api_key=search-XXXXXX&size=1&sources=qs&layers=locality&point.lat='.$_POST['lat'].'&point.lon='.$_POST['lng']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    $json = curl_exec($ch);
    curl_close($ch);
   $data=json_decode($json);
   $tricode=$data->features[0]->properties->country_a;
  echo $countries[$tricode];
  //echo $json;
?>
