<?php
$countries=[];
require_once("../db_inc.php");
$mysqli=new mysqli($dbserver,$username,$password,$database);
$box="POLYGON((".$_POST['maxNorth']." ".$_POST['minEast'].",".$_POST['maxNorth']." ".$_POST['maxEast'].",".$_POST['minNorth']." ".$_POST['maxEast'].",".$_POST['minNorth']." ".$_POST['minEast'].",".$_POST['maxNorth']." ".$_POST['minEast']."))";
$sql="SET @bbox=GeomFromText('".$box."')";
$mysqli->query($sql);
echo  "{\n\"polygons\": [";
$result = $mysqli->query("SELECT country,base,AsText(outline) FROM geopoly WHERE INTERSECTS(outline,@bbox)");
$started= false;
if($result->num_rows !==0) {
   while($polyinfo=$result->fetch_row()) {
   if($started) {
   echo ",";
   }
   $started="true";
    $countries[]= $polyinfo[0];
    echo  "\n{\n\"base\": $polyinfo[1],\n\"coords\": [[ ";
     // not very readable but much faster than regex
     echo str_replace(" ",",",str_replace(",","],[",str_replace(")","",str_replace("LINESTRING(","",$polyinfo[2]))))."]]\n}";
     }
}
$result->close();
echo "],\n";
echo "\"circles\": [\n";
$circledata = $mysqli->query("SELECT country,base,AsText(centre),radius FROM geocircle WHERE INTERSECTS(mbr,@bbox)");
if($circledata->num_rows !==0)  {
    $circlestarted=false;
    while($circleinfo=$circledata->fetch_row())  {
       if($circlestarted) {
       echo ",\n";
       }
      $countries[]= $circleinfo[0];
      $circlestarted=true;
      $centre=str_replace(" ",",",str_replace(")","]",str_replace("POINT(","[",$circleinfo[2])));
    echo "{\n\"base\":$circleinfo[1],\n\"centre\":$centre,\n\"radius\":$circleinfo[3]\n}";
    }
}
$circledata->close();
 $countrylist=array_unique($countries);
if(count($countrylist) > 0) {
 $inlist= "";
 $i=0;
foreach($countrylist as $country) {
   if($i >0)  {
     $inlist.= ",";
     }
     $i++;
     $inlist.="\"$country\"";
}
$countrysql="SELECT source, date_format(updated,'%b %Y') AS showdate FROM countries WHERE country IN($inlist)";
$countryset=$mysqli->query($countrysql);
if($countryset->num_rows ===0)  {
     $textout= "<br>None available for this region";
     }
else  {
     $textout="";
     while($countrylist=$countryset->fetch_assoc()) {
            $textout.="<br><a href='http://".$countrylist['source']."'>".$countrylist['source']."</a> updated ".$countrylist['showdate'];
        }
  }
$countryset->close();
   }
else  {
  $textout= "<br>Not available for this region";
}
$mysqli->close();
echo "\n],\n\"country\": \"$textout\"\n}\n";
?>
