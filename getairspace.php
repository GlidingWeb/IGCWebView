<?php
function getpolygons($whereclause) {
global $mysqli;
$polygons=array();
$polylist = $mysqli->query("SELECT base,AsText(outline) FROM geopoly WHERE $whereclause");
while($polygon=$polylist->fetch_row())
   {
   $reduced=str_replace(")","",str_replace("LINESTRING(","",str_replace(")LINESTRING(",",",$polygon[1])));
   $pointlist=explode(",",$reduced);
   unset($coordlist);
   foreach($pointlist as $point) {
     $splitpoint= explode(" ",$point);
     $coords['lat']=$splitpoint[0];
     $coords['lng']=$splitpoint[1];
     $coordlist[]=$coords;
   }
   $polygons[]=( object)array("base"=>$polygon[0],"coords"=>$coordlist);
   }
   $polylist->close();
   return  $polygons;
}

function getcircles($whereclause) {
global $mysqli;
$circlelist = $mysqli->query("SELECT base,AsText(centre),radius FROM geocircle WHERE $whereclause");
$circles=array();
   while($circle=$circlelist->fetch_row()) {
   $reduced=str_replace(")","",str_replace("POINT(","",$circle[1]));
   $splitpoint=explode(" ",$reduced);
   $centre['lat']=$splitpoint[0];
   $centre['lng']=$splitpoint[1];
    $circles[]=( object)array("base"=>$circle[0],"centre"=>$centre,"radius"=>$circle[2]);
   }
   return $circles;
}

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

 $degdist = 111; // km- circumference of the earth divided by 360
    
require_once("../db_inc.php");
$mysqli=new mysqli($dbserver,$username,$password,$database);
    //find box approx 333 Km from start pt each way
    $north=$_POST['lat'] + 3;
    if($north > 90) {
    $north=90;
    }
    $south=$_POST['lat'] - 3;
    if($south  < -90) {
    $south=-90;
    }
    $latcorr=cos(deg2rad($_POST['lat']));
    if($latcorr > 0)  {   //in case file error gives takeoff at a pole
     $east= $_POST['lng'] + 5/$latcorr;
     if($east > 180) {
     $east= 360-$east;
     }
     $west= $_POST['lng'] - 5/$latcorr;
     if($west < -180) {
     $west= 360 + $west;
     }
    }
    else {
    $east=180;
    $west=-180;
    }
  $box="POLYGON(($north $west,$north $east,$south $east,$south $west,$north $west))";
  $sql="SET @bbox=GeomFromText('".$box."')";
  $mysqli->query($sql);
  $wherepolygons="INTERSECTS(outline,@bbox)";
  $wherecircles="INTERSECTS(mbr,@bbox)";
  $retval['polygons']=getpolygons($wherepolygons);
  $retval['circles']=getcircles($wherecircles);
  echo json_encode($retval,JSON_NUMERIC_CHECK);
  $mysqli->close();
?>