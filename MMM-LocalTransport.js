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
        test: ""
    },
    start: function() {
        Log.info('Starting module: ' + this.name);
        //default certain global variables
        this.loaded = false;
        this.ignoredError = false;
        this.altTimeWalk = 'unknown';
        this.altTimeCycle = 'unknown';
        this.altTimeTransit = 'unknown';
        this.altTimeDrive = 'unknown';
        this.altSymbols = ['walk','cycle','rail','drive'];
        this.altModes = ['walking','bicycling','transit','driving'];
        
        
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
    sendRequest: function(requestName, mode) {
        this.config.mode = mode;
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
        this.sendRequest('LOCAL_TRANSPORT_REQUEST',this.config.mode);
        //request walking time
        if (this.config.displayAltWalk){
            this.sendRequest('LOCAL_TRANSPORT_WALK_REQUEST','walking');
        }
        //request cycling time
        if (this.config.displayAltCycle){
            this.sendRequest('LOCAL_TRANSPORT_CYCLE_REQUEST','bicycling');
        }
        //request driving time
        if (this.config.displayAltDrive){
            this.sendRequest('LOCAL_TRANSPORT_DRIVE_REQUEST','driving');
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
    convertTime: function(seconds){
        var ans = moment.duration(seconds, 'seconds').locale(this.config.language).humanize();
        if(this.config.displayWalkType === 'short'){
            ans = ans.replace(this.translate("MINUTE_PL"),this.translate("MINUTE_PS"));
            ans = ans.replace(this.translate("MINUTE_SL"),this.translate("MINUTE_SS"));
            ans = ans.replace(this.translate("SECOND_PL"),this.translate("SECOND_PS"));
        }
        return ans;
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
                wrapper.appendChild(getSymbol("walk",this.config.showColor));
                var span = document.createElement("span");
                span.innerHTML = this.convertTime(duration);
                if (this.config._laststop !== ''){
                   /* walking step doesn't have a departure_stop set - maybe something else but can't find the documentation right now.
                    so in order to display the departure, we will just save the arrival of any transit step into a global variable and 
                    display the previous arrival instead of the current departure location. That means we need to reset the global variable
                    to not cause interference between different routes and we need to skip the display for the first step if that is a walking
                    step (alternatively one could display the departure location specified by the user, but I prefer this option)
                    */
                   renderDeparture(span, this.config._laststop, this.translate("FROM"), this.config);
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
                renderDeparture(span, details.departure_stop.name, this.translate("FROM"), this.config);
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
        
        /*add alternative times*/
        var displayAlt = [this.config.displayAltWalk,this.config.displayAltCycle,this.config.displayAltTransit,this.config.displayAltDrive];
        var timeAlt = [this.altTimeWalk,this.altTimeCycle,this.altTimeTransit,this.altTimeDrive];
        for (i = 0; i < displayAlt.length; i++) {
            if (displayAlt[i]){
               li.appendChild(getSymbol(this.altSymbols[i],this.config.showColor));
               var span = this.renderAlternativeTime(timeAlt[i]);
               li.appendChild(span);
            }
        }
        return li;
    },
    receiveMain: function(notification, payload){
        var errlst = this.config.ignoreErrors;
        if(payload.data && payload.data.status === "OK"){
            //API request returned a result -> we are happy
            Log.log('received ' + notification);
            this.info = payload.data;
            this.loaded = true;
            this.ignoredError = false;
            this.config._headerDestPlan = shortenAddress(this.config._destination);
            //this.altTimeTransit = this.receiveAlternative(notification, payload);
            this.altTimeTransit = receiveAlternative(notification, payload, this.config.ignoreErrors);
            this.updateDom(this.config.animationSpeed * 1000);
        }else if(!payload.data){
            //API request returned nothing
            this.loaded = false;
            this.ignoredError = false;
        }else if(this.info && errlst.indexOf(payload.data.status) >= 0){
            //API request returned an error but we have previous results and permission to ignore it
            Log.info('received ' + notification + ' with status '+payload.data.status);
            this.ignoredError = true;
            this.loaded = true;
            this.updateDom(this.config.animationSpeed * 1000);
        }else{
            //API request returned an error so we don't have any routes to display -> show error
            Log.warn('received ' + notification + ' with status '+payload.data.status);
            this.ignoredError = false;
            this.info = payload.data;
            this.loaded = false;
            this.updateDom(this.config.animationSpeed * 1000);
        }
    },
    socketNotificationReceived: function(notification, payload) {
        /*socketNotificationReceived
         *handles notifications send by this module
         */
        if (payload.id === this.identifier){
            switch(notification){
                case 'LOCAL_TRANSPORT_RESPONSE':
                    //Received response on public transport routes (main one)
                    this.receiveMain(notification, payload);
                    break;
                case 'LOCAL_TRANSPORT_WALK_RESPONSE':
                    //Received response on walking alternative
                    //this.altTimeWalk = this.receiveAlternative(notification, payload);
                    this.altTimeWalk = receiveAlternative(notification, payload, this.config.ignoreErrors);
                    this.updateDom();
                    break;
                case 'LOCAL_TRANSPORT_CYCLE_RESPONSE':
                    //Received response on cycling alternative
                    //this.altTimeCycle = this.receiveAlternative(notification, payload);
                    this.altTimeCycle = receiveAlternative(notification, payload, this.config.ignoreErrors);
                    this.updateDom();
                    break;
                case 'LOCAL_TRANSPORT_DRIVE_RESPONSE':
                    //Received response on driving alternative
                    //this.altTimeDrive = this.receiveAlternative(notification, payload);
                    this.altTimeDrive = receiveAlternative(notification, payload, this.config.ignoreErrors);
                    this.updateDom();
            }
        }
    },
    calendarReceived: function(notification, payload, sender) {
        Log.info('received ' + notification);
        var dn = new Date();
        //var oneSecond = 1000; // 1,000 milliseconds
        //var oneMinute = oneSecond * 60;
        //var oneHour = oneMinute * 60;
        var oneDay = 1000 * 60 * 60 * 24;
        
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
    },
    notificationReceived: function(notification, payload, sender) {
        /*notificationReceived
         *handles notifications send by other modules
         */
        if (notification === 'CALENDAR_EVENTS' && sender.name === 'calendar' && this.config.getCalendarLocation) {
            //received calendar events AND user wants events to influence the travel destination.
            this.calendarReceived(notification, payload, sender);
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
        this.config._headerOrigPlan = shortenAddress(this.config.origin);
        header = header.replace("%{orig}", this.config._headerOrigPlan);
    
        return header;
    },
    getStyles: function() {
        return ["localtransport.css"];
    },
    getScripts: function() {
        return ["moment.js","helper.js"];
    },
    getTranslations: function() {
        return {
            en: "i18n/en.json",
            de: "i18n/de.json",
            sv: "i18n/sv.json",
            fr: "i18n/fr.json"
        };
    },
    getDom: function() {
        /* main function creating HTML code to display*/
        this.config._headerDest = this.config._headerDestPlan; //resetting _headerDest in case there was an error loading...
        var wrapper = document.createElement("div");
        /*if (!this.loaded || !this.info) {
            if(!this.info){
                wrapper.innerHTML = this.translate("LOADING_CONNECTIONS");
            }else{
                wrapper.innerHTML = this.translate(this.info.status);
            }
            wrapper.className = "small dimmed";*/
        if (!this.loaded && !this.info) {
            /*if not loaded, display message*/
            wrapper.innerHTML = this.translate("LOADING_CONNECTIONS");
            wrapper.className = "small dimmed";
        }else if (!this.loaded){
            /*if not loaded, display message*/
            wrapper.innerHTML = this.translate(this.info.status);
            wrapper.className = "small dimmed";
        }else{
            /*we have routes -> render them*/
            var routeArray = []; //array of all alternatives for later sorting
            for(var routeKey in this.info.routes) {
                /*each route describes a way to get from A to Z*/
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
                    this.config._headerDest = shortenAddress(leg.end_address);
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
                            //renderStep(tmpwrapper, step, this.translate("FROM"), config);
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
                    //this.renderLeg(li, leg);
                    renderLeg(li, leg, this.translate("ARRIVAL"), this.config, );
                    li.appendChild(tmpwrapper);
                }
                if (li.innerHTML !== "too far"){
                    routeArray.push({"arrival":arrival,"html":li});
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
            
            /*create an unsorted list with each
             *route alternative being a new list item*/
            //var ul = document.createElement("ul");

            /*create fade effect and append list items to the list*/
            var ul = renderFade(routeArray,this.config);
            wrapper.appendChild(ul);
        }
        return wrapper;
    }

});