/* small collection of functions that do basic things
 * main purpose is to reduce the number of functions per file
 */

function getSymbol(symName,showColor){
    var img = document.createElement("img");
    if(showColor){
        img.className = "symbol";
    }else{
        img.className = "symbol bw";
    }
    img.src = "https://maps.gstatic.com/mapfiles/transit/iw2/6/"+symName+".png";
    //img.src = "/localtransport/"+symName+".png"; //needs to be saved in localtransport/public/walk.png
    return img;
}


function shorten(string, maxLength) {
    /*shorten
     *shortens a string to the number of characters specified*/
    if (string.length > maxLength) {
        return string.slice(0,maxLength) + "&hellip;";
    }
    return string;
}
    
function shortenAddress(address) {
    /*shortenAddress
     *shortens a string to the first part of an address
     *this assumes that the address string is split by ','
     *useful since Google will require a very precise 
     *definition of an address while the user would usually
     *know which city and country they are looking at*/
    var temp = address.split(",");
    return temp[0];
}