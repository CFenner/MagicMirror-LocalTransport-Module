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

function receiveAlternative(notification, payload, ignoreErrors){
        var ans = "unknown";
        var errlst = ignoreErrors;
        if(payload.data && payload.data.status === "OK"){
            Log.log('received ' + notification);
            //only interested in duration, first option should be the shortest one
            var route = payload.data.routes[0];
            var leg = route.legs[0];
            ans = leg.duration.value;
        }else if (errlst.indexOf(payload.data.status) < 0){
            Log.warn('received '+notification+' with status '+payload.data.status);
        }else{
            Log.info('received '+notification+' with status '+payload.data.status);
        }
        return ans;
}

function renderLeg(wrapper, leg, arrivalWord, config){
        /* renderLeg
         * creates HTML element for one leg of a route
         */
        var depature = leg.departure_time.value * 1000;
        var arrival = leg.arrival_time.value * 1000;
        var span = document.createElement("div");
        span.className = "small bright";
        span.innerHTML = moment(depature).locale(config.language).fromNow();
        if (config.displayArrival){
            span.innerHTML += " ("+config.test+arrivalWord+": ";
            if (config.timeFormat === 24){
                span.innerHTML += moment(arrival).format("H:mm");
            }else{
                span.innerHTML += moment(arrival).format("h:mm");
            }
            span.innerHTML += ")";
        }
        wrapper.appendChild(span);
}

function renderDeparture(span, departureStop, fromWord, config){
    if (config.displayStationLength > 0){
        /* add departure stop (shortened)*/
        span.innerHTML += " ("+fromWord+" " + shorten(departureStop, config.displayStationLength) + ")";
    }else if (config.displayStationLength === 0){
        /* add departure stop*/
        span.innerHTML += " ("+fromWord+" " + config._laststop + ")";
    }
}

function calcOpacity(Nrs,e,config){
    if (config.fadePoint < 0) {
        config.fadePoint = 0;
    }
    if (config.fade && config.fadePoint < 1) {
        var startingPoint = Nrs * config.fadePoint;
        var steps = Nrs - startingPoint;
        if (e >= startingPoint) {
            var currentStep = e - startingPoint;
            return = 1 - (1 / steps * currentStep);
        }
    }else{
        return 1;
    }
}

function renderFade(routeArray,config){
    /*create fade effect and append list items to the list*/
    var ul = document.createElement("ul");
    var e = 0;
    var Nrs = routeArray.length;
    for(var dataKey in routeArray) {
        var routeData = routeArray[dataKey];
        var routeHtml = routeData.html;
        // Create fade effect.
        routeHtml.style.opacity = calcOpacity(Nrs,e,config);
        ul.appendChild(routeHtml);
        e += 1;
    }
    return ul
}

//function renderStep(wrapper, step, fromWord, config){
	// /* renderStep
	 // * creates HTML element for one step of a leg
	 // */
	// if(step.travel_mode === "WALKING"){
		// /*this step is not public transport but walking*/
		// var duration = step.duration.value;
		// if (duration >= (config.maxWalkTime*60)){
			// /*if time of walking is longer than
			 // *specified, mark this route to be skipped*/
			// wrapper.innerHTML = "too far";
		// }else if(config.displayWalkType != 'none'){
			// /*if walking and walking times should be
			 // *specified, add symbol and time*/
			// wrapper.appendChild(getSymbol("walk",config.showColor));
			// var span = document.createElement("span");
			// span.innerHTML = this.convertTime(duration);
			// if (config._laststop !== ''){
			   // /* walking step doesn't have a departure_stop set - maybe something else but can't find the documentation right now.
				// so in order to display the departure, we will just save the arrival of any transit step into a global variable and 
				// display the previous arrival instead of the current departure location. That means we need to reset the global variable
				// to not cause interference between different routes and we need to skip the display for the first step if that is a walking
				// step (alternatively one could display the departure location specified by the user, but I prefer this option)
				// */
			   // if (config.displayStationLength > 0){
				  // /* add departure stop (shortened)*/
				  // span.innerHTML += " ("+fromWord+" " + shorten(config._laststop, config.displayStationLength) + ")";
			   // }else if (config.displayStationLength === 0){
				  // /* add departure stop*/
				  // span.innerHTML += " ("+fromWord+" " + config._laststop + ")";
			   // }
			// }
			// span.className = "xsmall dimmed";
			// wrapper.appendChild(span);
		// }else{
			// /*skip walking*/
			// return;
		// }
		// config._laststop = '';
	// }else{
		// /*if this is a transit step*/
		// var details = step.transit_details;
		// if(details) {
			// /*add symbol of transport vehicle*/
			// var img = document.createElement("img");
			// if(config.showColor){
				// img.className = "symbol";
			// }else{
				// img.className = "symbol bw";
			// }
			// /* get symbol online*/
			// img.src = details.line.vehicle.local_icon || ("https:" + details.line.vehicle.icon);
			// /* can provide own symbols under /localtransport/public/*.png */
			// //img.src = "/localtransport/" + details.line.vehicle.name + ".png";
			// img.alt = "[" + details.line.vehicle.name +"]";
			// wrapper.appendChild(img);
			// /*add description*/
			// var span = document.createElement("span");
			// /* add line name*/
			// span.innerHTML = details.line.short_name || details.line.name;
			// if (config.displayStationLength > 0){
				// /* add departure stop (shortened)*/
				// span.innerHTML += " ("+fromWord+" " + shorten(details.departure_stop.name, config.displayStationLength) + ")";
			// }else if (config.displayStationLength === 0){
				// /* add departure stop*/
				// span.innerHTML += " ("+fromWord+" " + details.departure_stop.name + ")";
			// }
			// if (config.debug){
				// /* add vehicle type for debug*/
				// span.innerHTML += " [" + details.line.vehicle.name +"]";
			// }
			// config._laststop = details.arrival_stop.name;
			// span.className = "xsmall dimmed";
			// wrapper.appendChild(span);
		// }
	// }
// }