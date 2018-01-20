/* global Module */
/* Magic Mirror
 * Module: MMM-LocalTransport
 *
 * By Christopher Fenner https://github.com/CFenner
 * style options and calendar extension by Lasse Wollatz https://github.com/GHLasse
 * MIT Licensed.
 */
Module.register('MMM-LocalTransport', {
    defaults: {
        maximumEntries: 3, //maximum number of Routes to display
        displayStationLength: 0,
        displayWalkType: 'short',
        displayArrival: true, //display arrival time
        displayAltWalk: false, //display info about how long walking would take
        displayAltCycle: false, //display info about how long cycling would take
        displayAltDrive: false, //display info about how long driving would take
        displayAltTransit: false, //display info about how long public transport does take
        maxWalkTime: 10, //maximum acceptable walking time between stations
        fade: true, //apply fading effect
        fadePoint: 0.1,
        showColor: true, //display transport icons in colour
        maxModuleWidth: 0,
        animationSpeed: 1,
        updateInterval: 5, //in min, how often to request new routes
        language: config.language,
        units: config.units,
        timeFormat: config.timeFormat,
        mode: 'transit',
        traffic_model: 'best_guess',
        departure_time: 'now',
        alternatives: true,
        getCalendarLocation: false,  //read calendar notifications to display the route to the next event.
        api_key: 'YOUR_API_KEY',
        apiBase: 'https://maps.googleapis.com/',
        apiEndpoint: 'maps/api/directions/json',
        debug: false, 
        ignoreErrors: ["OK","OVER_QUERY_LIMIT","UNKNOWN_ERROR"], //any of: OK, NOT_FOUND, ZERO_RESULTS, MAX_WAYPOINTS_EXCEEDED, INVALID_REQUEST, OVER_QUERY_LIMIT, REQUEST_DENIED, UNKNOWN_ERROR
        _laststop: '', //the variables with _ are for internal use only - should consider defining them elsewhere!
        _headerDest: '',
        _headerDestPlan: '',
        _headerOrigPlan: '',
        _destination: '', //actual destination requested from Google
        _walktime: 'unknown',
        _cycletime: 'unknown',
        _drivetime: 'unknown',
        test: ""
    },
    start: function() {
        Log.info('Starting module: ' + this.name);
        //default certain global variables
        this.loaded = false;
        this.ignoredError = false;
        this.transittime = 'unknown';
        
        if (this.config.api_key === 'YOUR_API_KEY'){
            /*if there is no api key specified in the options of the module,
            look it up in the main config-file settings */
            this.config.api_key = config.apiKeys.google;
        }
        this.config._destination = this.config.destination;
        this.url = this.config.apiBase + this.config.apiEndpoint + this.getParams();
        var d = new Date();
        this.lastupdate = d.getTime() - 2 * this.config.updateInterval * 60 * 1000;
        this.update();
        // refresh every 0.25 minutes so that the time left till departure is always correct without having to request an update from Google every time.
        setInterval(
            this.update.bind(this),
            15 * 1000);
    },
    update: function() {
        //updateDOM
        var dn = new Date();
        if (dn.getTime() - this.lastupdate >= this.config.updateInterval * 60 * 1000){
            //perform main update
            this.doMainUpdate();
            this.lastupdate = dn.getTime();
        }else{
            //perform minor update
            //only update time
            if (this.config.debug){
              this.sendNotification("SHOW_ALERT", {timer: 3000, title: "LOCAL TRANSPORT", message: "normal update"});
            }
            //this.loaded = false;
            this.updateDom(); //this.updateDom(this.config.animationSpeed * 1000)
        }
    },
    sendRequest: function(requestName) {
        this.sendSocketNotification(
            requestName, {
                id: this.identifier,
                url: this.config.apiBase + this.config.apiEndpoint + this.getParams()
            }
        );
        Log.log("requested "+requestName);
        this.config.mode = 'transit';
    },
    doMainUpdate: function() {
        /*doMainUpdate
         *requests routes from Google for public transport and any alternatives if applicable.
         */
        //request routes from Google
        this.loaded = false;
        this.sendRequest('LOCAL_TRANSPORT_REQUEST');
        //request walking time
        if (this.config.displayAltWalk){
            this.config.mode = 'walking';
            this.sendRequest('LOCAL_TRANSPORT_WALK_REQUEST');
        }
        //request cycling time
        if (this.config.displayAltCycle){
            this.config.mode = 'bicycling';
            this.sendRequest('LOCAL_TRANSPORT_CYCLE_REQUEST');
        }
        //request driving time
        if (this.config.displayAltDrive){
            this.config.mode = 'driving';
            this.sendRequest('LOCAL_TRANSPORT_DRIVE_REQUEST');
        }
        if (this.config.debug){
            this.sendNotification("SHOW_ALERT", { timer: 3000, title: "LOCAL TRANSPORT", message: "special update"});
        }
    },
    getParams: function() {
        var params = '?';
        params += 'mode=' + this.config.mode;
        params += '&origin=' + this.config.origin;
        params += '&destination=' + this.config._destination;
        params += '&key=' + this.config.api_key;
        params += '&traffic_model=' + this.config.traffic_model;
        params += '&departure_time=now';
        params += '&alternatives=true';
        return params;
    },
    getSymbol: function(symName){
        var img = document.createElement("img");
        if(this.config.showColor){
            img.className = "symbol";
        }else{
            img.className = "symbol bw";
        }
        img.src = "https://maps.gstatic.com/mapfiles/transit/iw2/6/"+symName+".png";
        //img.src = "/localtransport/"+symName+".png"; //needs to be saved in localtransport/public/walk.png
        return img;
    },
    convertTime: function(seconds){
        var ans = moment.duration(seconds, 'seconds').locale(this.config.language).humanize();
        if(this.config.displayWalkType === 'short'){
            ans = ans.replace(this.translate("MINUTE_PL"),this.translate("MINUTE_PS"));
            ans = ans.replace(this.translate("MINUTE_SL"),this.translate("MINUTE_SS"));
            ans = ans.replace(this.translate("SECOND_PL"),this.translate("SECOND_PS"));
        }
        return ans;
    },
    renderLeg: function(wrapper, leg){
        /* renderLeg
         * creates HTML element for one leg of a route
         */
        var depature = leg.departure_time.value * 1000;
        var arrival = leg.arrival_time.value * 1000;
        //var depadd = leg.start_address;
        var span = document.createElement("div");
        span.className = "small bright";
        span.innerHTML = moment(depature).locale(this.config.language).fromNow();
        // span.innerHTML += "from " + depadd;
        if (this.config.displayArrival && this.config.timeFormat === 24){
            span.innerHTML += " ("+this.config.test+this.translate("ARRIVAL")+": " + moment(arrival).format("H:mm") + ")";
        }else if(this.config.displayArrival){
            span.innerHTML += " ("+this.config.test+this.translate("ARRIVAL")+": " + moment(arrival).format("h:mm") + ")";
        }
        // span.innerHTML += this.translate('TRAVEL_TIME') + ": ";
        // span.innerHTML += moment.duration(moment(arrival).diff(depature, 'minutes'), 'minutes').humanize();
        wrapper.appendChild(span);
    },
    renderStep: function(wrapper, step){
        /* renderStep
         * creates HTML element for one step of a leg
         */
        if(step.travel_mode === "WALKING"){
            /*this step is not public transport but walking*/
            var duration = step.duration.value;
            if (duration >= (this.config.maxWalkTime*60)){
                /*if time of walking is longer than
                 *specified, mark this route to be skipped*/
                wrapper.innerHTML = "too far";
            }else if(this.config.displayWalkType != 'none'){
                /*if walking and walking times should be
                 *specified, add symbol and time*/
                wrapper.appendChild(this.getSymbol("walk"));
                var span = document.createElement("span");
                span.innerHTML = this.convertTime(duration);
                if (this.config._laststop !== ''){
                   /* walking step doesn't have a departure_stop set - maybe something else but can't find the documentation right now.
                    so in order to display the departure, we will just save the arrival of any transit step into a global variable and 
                    display the previous arrival instead of the current departure location. That means we need to reset the global variable
                    to not cause interference between different routes and we need to skip the display for the first step if that is a walking
                    step (alternatively one could display the departure location specified by the user, but I prefer this option)
                    */
                   if (this.config.displayStationLength > 0){
                      /* add departure stop (shortened)*/
                      span.innerHTML += " ("+this.translate("FROM")+" " + this.shorten(this.config._laststop, this.config.displayStationLength) + ")";
                   }else if (this.config.displayStationLength === 0){
                      /* add departure stop*/
                      span.innerHTML += " ("+this.translate("FROM")+" " + this.config._laststop + ")";
                   }
                }
                span.className = "xsmall dimmed";
                wrapper.appendChild(span);
            }else{
                /*skip walking*/
                return;
            }
            this.config._laststop = '';
        }else{
            /*if this is a transit step*/
            var details = step.transit_details;
            if(details) {
                /*add symbol of transport vehicle*/
                var img = document.createElement("img");
                if(this.config.showColor){
                    img.className = "symbol";
                }else{
                    img.className = "symbol bw";
                }
                /* get symbol online*/
                img.src = details.line.vehicle.local_icon || ("https:" + details.line.vehicle.icon);
                /* can provide own symbols under /localtransport/public/*.png */
                //img.src = "/localtransport/" + details.line.vehicle.name + ".png";
                img.alt = "[" + details.line.vehicle.name +"]";
                wrapper.appendChild(img);
                /*add description*/
                var span = document.createElement("span");
                /* add line name*/
                span.innerHTML = details.line.short_name || details.line.name;
                if (this.config.displayStationLength > 0){
                    /* add departure stop (shortened)*/
                    span.innerHTML += " ("+this.translate("FROM")+" " + this.shorten(details.departure_stop.name, this.config.displayStationLength) + ")";
                }else if (this.config.displayStationLength === 0){
                    /* add departure stop*/
                    span.innerHTML += " ("+this.translate("FROM")+" " + details.departure_stop.name + ")";
                }
                if (this.config.debug){
                    /* add vehicle type for debug*/
                    span.innerHTML += " [" + details.line.vehicle.name +"]";
                }
                this.config._laststop = details.arrival_stop.name;
                span.className = "xsmall dimmed";
                wrapper.appendChild(span);
            }
        }
    },
    
    renderAlternativeTime: function(time){
        var span = document.createElement("span");
        if(time != "unknown"){
            span.innerHTML = this.convertTime(time);
        }else{
            span.innerHTML = "n/a";
        }
        return span;
    },
    
    renderAlternatives: function(){
        /*creates a <li> containing the duration for ALTERNATIVE transport methods*/
        var li = document.createElement("li");
        li.className = "small";
        //intro
        var span = document.createElement("span");
        span.innerHTML = this.translate("ALT") + ": ";
        li.appendChild(span);
        /*add alternative walking time*/
        if (this.config.displayAltWalk){
            li.appendChild(this.getSymbol("walk"));
            var span = this.renderAlternativeTime(this.config._walktime)
            li.appendChild(span);
        }
        /*add alternative cycling time*/
        if (this.config.displayAltCycle){
            li.appendChild(this.getSymbol("cycle"));
            var span = this.renderAlternativeTime(this.config._cycletime);
            li.appendChild(span);
        }
        /*add alternative driving time*/
        if (this.config.displayAltTransit){
            li.appendChild(this.getSymbol("rail"));
            var span = this.renderAlternativeTime(this.transittime);
            li.appendChild(span);
        }
        /*add alternative driving time*/
        if (this.config.displayAltDrive){
            li.appendChild(this.getSymbol("drive"));
            var span = this.renderAlternativeTime(this.config._drivetime);
            li.appendChild(span);
        }
        return li;
    },
    receiveAlternative: function(notification, payload){
        var ans = ""
        if(payload.data && payload.data.status === "OK"){
            Log.log('received ' + notification);
            //only interested in duration, first option should be the shortest one
            var route = payload.data.routes[0];
            var leg = route.legs[0];
            ans = leg.duration.value;
        }else{
            ans = "unknown";
            var errlst = this.config.ignoreErrors
            if (errlst.indexOf(payload.data.status) < 0){
                Log.warn('received '+notification+' with status '+payload.data.status);
            }else{
                Log.info('received '+notification+' with status '+payload.data.status);
            }
        }
        this.updateDom();
        return ans;
    },
    socketNotificationReceived: function(notification, payload) {
        /*socketNotificationReceived
         *handles notifications send by this module
         */
        if (notification === 'LOCAL_TRANSPORT_RESPONSE' && payload.id === this.identifier) {
            //Received response on public transport routes (main one)
            
            if(payload.data && payload.data.status === "OK"){
                Log.log('received ' + notification);
                this.info = payload.data;
                this.loaded = true;
                this.ignoredError = false;
                this.config._headerDestPlan = this.shortenAddress(this.config._destination);
                this.transittime = this.receiveAlternative(notification, payload);
                this.updateDom(this.config.animationSpeed * 1000);
            }else if(!payload.data){
                this.loaded = false;
                this.ignoredError = false;
            }else{
                var errlst = this.config.ignoreErrors
                if (this.info && errlst.indexOf(payload.data.status) >= 0){
                   Log.info('received ' + notification + ' with status '+payload.data.status);
                   this.ignoredError = true;
                   this.loaded = true;
                   this.updateDom(this.config.animationSpeed * 1000);
                }else{
                   Log.warn('received ' + notification + ' with status '+payload.data.status);
                   this.ignoredError = false;
                   this.info = payload.data;
                   this.loaded = false;
                   this.updateDom(this.config.animationSpeed * 1000);
                }
            }
        }
        if (notification === 'LOCAL_TRANSPORT_WALK_RESPONSE' && payload.id === this.identifier) {
            //Received response on routes for walking
            this.config._walktime = this.receiveAlternative(notification, payload);
        }
        if (notification === 'LOCAL_TRANSPORT_CYCLE_RESPONSE' && payload.id === this.identifier) {
            //Received response on routes for bicycle
            this.config._cycletime = this.receiveAlternative(notification, payload);
        }
        if (notification === 'LOCAL_TRANSPORT_DRIVE_RESPONSE' && payload.id === this.identifier) {
            //Received response on routes for driving
            this.config._drivetime = this.receiveAlternative(notification, payload);
        }
    },
    notificationReceived: function(notification, payload, sender) {
        /*notificationReceived
         *handles notifications send by other modules
         */
        if (notification === 'CALENDAR_EVENTS' && sender.name === 'calendar' && this.config.getCalendarLocation) {
            //received calendar events AND user wants events to influence the travel destination.
            Log.info('received ' + notification);
            var dn = new Date();
            var oneSecond = 1000; // 1,000 milliseconds
            var oneMinute = oneSecond * 60;
            var oneHour = oneMinute * 60;
            var oneDay = oneHour * 24;
            
            var value;
            for (let x of payload) {
              //go through the events, pick first one with a set location.
              //also ignore running events
              if(x.location !== '' && x.location !== false && x.startDate - dn >= 0){
                  value = x;
                  break;
              }
            }
            //check if event is less than one day away
            if(value.startDate - dn - oneDay <= 0){
                //if so, then update the destination and request an update of the routes
                this.config._destination = value.location;
                this.doMainUpdate();
                this.lastupdate = dn.getTime();
            }else{
                //if not, then make sure the default destination is set again.
                this.config._destination = this.config.destination;
            }
            
            if (this.config.debug){
              this.sendNotification("SHOW_ALERT", { timer: 3000, title: "LOCAL TRANSPORT", message: "calendar update"});
            }
            
        }
    },
    getHeader: function() {
        var header = this.data.header;
        //use %{destX} in the header definition for the module and it will be replaces with the destination as returned by Google
        header = header.replace("%{destX}", this.config._headerDest);
        //use %{dest} in the header definition for the module and it will be replaces with the destination as defined in the config/ calendar event
        if(!this.ignoredError){
            header = header.replace("%{dest}", this.config._headerDestPlan);
        }else{ //in case the last request returned an error an we use the previous data, then better use the destination of the last request as well.
            header = header.replace("%{dest}", this.config._headerDest);
        }
        //use %{orig} in the header definition for the module and it will be replaces with the origin as defined in the config
        this.config._headerOrigPlan = this.shortenAddress(this.config.origin);
        header = header.replace("%{orig}", this.config._headerOrigPlan);
    
        return header;
    },
    getStyles: function() {
        return ["localtransport.css"];
    },
    getScripts: function() {
        return ["moment.js"];
    },
    getTranslations: function() {
        return {
            de: "i18n/de.json",
            en: "i18n/en.json",
            sv: "i18n/sv.json",
            fr: "i18n/fr.json"
        };
    },
    getDom: function() {
        /* main function creating HTML code to display*/
        this.config._headerDest = this.config._headerDestPlan; //resetting _headerDest in case there was an error loading...
        var wrapper = document.createElement("div");
        if (!this.loaded || !this.info) {
            /*if not loaded, display message*/
            if(!this.info){
                wrapper.innerHTML = this.translate("LOADING_CONNECTIONS");
            }else{
                wrapper.innerHTML = this.translate(this.info.status);
			}
            wrapper.className = "small dimmed";
        }else{
            /*create an unsorted list with each
             *route alternative being a new list item*/
            var ul = document.createElement("ul");
            var Nrs = 0; //number of routes
            var routeArray = []; //array of all alternatives for later sorting
            for(var routeKey in this.info.routes) {
                /*each route describes a way to get from A to Z*/
                //if(Nrs >= this.config.maxAlternatives){
                //  break;
                //}
                var route = this.info.routes[routeKey];
                var li = document.createElement("li");
                li.className = "small";
                var arrival = 0;
                if (this.config.maxModuleWidth > 0){
                  li.style.width = this.config.maxModuleWidth + "px";
                }
                for(var legKey in route.legs) {
                    var leg = route.legs[legKey];
                    var tmpwrapper = document.createElement("text");
                    this.config._headerDest = this.shortenAddress(leg.end_address);
                    this.config._laststop = ''; //need to reset the _laststop in case the previous leg didn't end with a walking step.
                    try {
                        
                        arrival = leg.arrival_time.value;
                        for(var stepKey in leg.steps) {
                            /*each leg consists of several steps
                             *e.g. (1) walk from A to B, then
                                   (2) take the bus from B to C and then
                                   (3) walk from C to Z*/
                             var step = leg.steps[stepKey];
                            this.renderStep(tmpwrapper, step);
                            if (tmpwrapper.innerHTML === "too far"){
                                //walking distance was too long -> skip this option
                                break;
                            }
                        }
                    }
                    catch(err) {
                        tmpwrapper.innerHTML = "too far";
                    }
                    if (tmpwrapper.innerHTML === "too far"){
                        //walking distance was too long -> skip this option
                        li.innerHTML = "too far";
                        break;
                    }
                    this.renderLeg(li, leg);
                    li.appendChild(tmpwrapper);
                }
                if (li.innerHTML !== "too far"){
                    routeArray.push({"arrival":arrival,"html":li});
                    Nrs += 1;
                }
            }

            /*sort the different alternative routes by arrival time*/
            routeArray.sort(function(a, b) {
                return parseFloat(a.arrival) - parseFloat(b.arrival);
            });
            /*only show the first few options as specified by "maximumEntries"*/
            routeArray = routeArray.slice(0, this.config.maximumEntries);
            
            /*add ALTERNATIVE transport notes*/
            if (this.config.displayAltWalk || this.config.displayAltCycle || this.config.displayAltDrive){
                var li = this.renderAlternatives();
                routeArray.push({"arrival":'',"html":li});
            }

            /*create fade effect and append list items to the list*/
            var e = 0;
            Nrs = routeArray.length;
            for(var dataKey in routeArray) {
                var routeData = routeArray[dataKey];
                var routeHtml = routeData.html;
                // Create fade effect.
                if (this.config.fade && this.config.fadePoint < 1) {
                    if (this.config.fadePoint < 0) {
                        this.config.fadePoint = 0;
                    }
                    var startingPoint = Nrs * this.config.fadePoint;
                    var steps = Nrs - startingPoint;
                    if (e >= startingPoint) {
                        var currentStep = e - startingPoint;
                        routeHtml.style.opacity = 1 - (1 / steps * currentStep);
                    }
                }
                ul.appendChild(routeHtml);
                e += 1;
            }
            wrapper.appendChild(ul);
        }
        return wrapper;
    },
    shorten: function(string, maxLength) {
        /*shorten
         *shortens a string to the number of characters specified*/
        if (string.length > maxLength) {
            return string.slice(0,maxLength) + "&hellip;";
        }
        return string;
    },
    shortenAddress: function(address) {
        /*shortenAddress
         *shortens a string to the first part of an address
         *this assumes that the address string is split by ','
         *useful since Google will require a very precise 
         *definition of an address while the user would usually
         *know which city and country they are looking at*/
        var temp = address.split(",");
        return temp[0];
    }

});
