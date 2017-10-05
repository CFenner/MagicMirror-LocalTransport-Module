/* global Module */
/* Magic Mirror
 * Module: localtransport
 *
 * By Christopher Fenner https://github.com/CFenner
 * style options by Lasse Wollatz
 * MIT Licensed.
 */
Module.register('localtransport', {
  defaults: {
    maximumEntries: 3,
    displayStationLength: 0,
    displayWalkType: 'short',
    displayArrival: true,
    maxWalkTime: 10,
    fade: true,
    fadePoint: 0.1,
    maxModuleWidth: 0,
    animationSpeed: 1,
    updateInterval: 5,
    language: config.language,
    units: config.units,
    timeFormat: config.timeFormat,
    mode: 'transit',
    traffic_model: 'best_guess',
    departure_time: 'now',
    alternatives: true,
    api_key: 'YOUR_API_KEY',
    apiBase: 'https://maps.googleapis.com/',
    apiEndpoint: 'maps/api/directions/json',
    debug: false,
    _laststop: ''
  },
  start: function() {
    Log.info('Starting module: ' + this.name);
    this.loaded = false;
    if (this.config.api_key == 'YOUR_API_KEY'){
      this.config.api_key = config.apiKeys.google;
    }
    this.url = this.config.apiBase + this.config.apiEndpoint + this.getParams();
    var d = new Date(); 
    this.lastupdate = d.getTime() - 2 * this.config.updateInterval * 60 * 1000;
    this.update();
    // refresh every 0.25 minutes
    setInterval(
        this.update.bind(this),
        15 * 1000);
  },
  update: function() {
    //updateDOM
    var dn = new Date(); 
    if (dn.getTime() - this.lastupdate >= this.config.updateInterval * 60 * 1000){
        //perform main update 
        //request routes from Google
        this.sendSocketNotification(
            'LOCAL_TRANSPORT_REQUEST', {
                id: this.identifier,
                url: this.config.apiBase + this.config.apiEndpoint + this.getParams()
            }
        );
        if (this.config.debug){
          this.sendNotification("SHOW_ALERT", { timer: 3000, title: "LOCAL TRANSPORT", message: "special update"});
        }
        this.lastupdate = dn.getTime();
    }else{
        //perform minor update
        //only update time
        if (this.config.debug){
          this.sendNotification("SHOW_ALERT", {timer: 3000, title: "LOCAL TRANSPORT", message: "normal update"});
        }
        this.loaded = true;
        this.updateDom(); //this.updateDom(this.config.animationSpeed * 1000)
    }
  },
  getParams: function() {
    var params = '?';
    params += 'mode=' + this.config.mode;
    params += '&origin=' + this.config.origin;
    params += '&destination=' + this.config.destination;
    params += '&key=' + this.config.api_key;
    params += '&traffic_model=' + this.config.traffic_model;
    params += '&departure_time=now';
    params += '&alternatives=true';
    return params;
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
    if (this.config.displayArrival && this.config.timeFormat == 24){
        span.innerHTML += " ("+this.translate("ARRIVAL")+": " + moment(arrival).format("H:mm") + ")";
    }else if(this.config.displayArrival){
        span.innerHTML += " ("+this.translate("ARRIVAL")+": " + moment(arrival).format("h:mm") + ")";
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
            var img = document.createElement("img");
            if(this.config.showColor){
                img.className = "symbol";
            }else{
                img.className = "symbol bw";
            }
            img.src = "http://maps.gstatic.com/mapfiles/transit/iw2/6/walk.png";
            //img.src = "/localtransport/walk.png"; //needs to be saved in localtransport/public/walk.png
            wrapper.appendChild(img)
            var span = document.createElement("span");
            span.innerHTML = moment.duration(duration, 'seconds').locale(this.config.language).humanize();
            if(this.config.displayWalkType == 'short'){
                span.innerHTML = span.innerHTML.replace(this.translate("MINUTE_PL"),this.translate("MINUTE_PS"));
                span.innerHTML = span.innerHTML.replace(this.translate("MINUTE_SL"),this.translate("MINUTE_SS"));
                span.innerHTML = span.innerHTML.replace(this.translate("SECOND_PL"),this.translate("SECOND_PS"));
            }
            if (this.config._laststop !== ''){
               /* walking leg doesn't have a departure_stop set - maybe something else but can't find the documentation right now.
                so in order to display the departure, we will just save the arrival of any transit leg into a global variable and 
                display the previous arrival instead of the current departure location. That means we need to reset the global variable
                to not cause interference between different routes and we need to skip the display for the first leg if that is a walking
                leg (alternatively one could display the departure location specified by the user, but I prefer this option)
                */
               if (this.config.displayStationLength > 0){
                  /* add departure stop (shortened)*/
                  span.innerHTML += " ("+this.translate("FROM")+" " + this.shorten(this.config._laststop, this.config.displayStationLength) + ")";
               }else if (this.config.displayStationLength == 0){
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
            img.src = details.line.vehicle.local_icon || ("http:" + details.line.vehicle.icon);
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
            }else if (this.config.displayStationLength == 0){
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
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'LOCAL_TRANSPORT_RESPONSE' && payload.id === this.identifier) {
        Log.info('received' + notification);
        if(payload.data && payload.data.status === "OK"){
            this.data = payload.data;
            this.loaded = true;
            this.updateDom(this.config.animationSpeed * 1000);
        }
    }
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
        en: "i18n/en.json"
    };
  },
  getDom: function() {
    /* main function creating HTML code to display*/
    var wrapper = document.createElement("div");
    if (!this.loaded) {
        /*if not loaded, display message*/
        wrapper.innerHTML = this.translate("LOADING_CONNECTIONS");
        wrapper.className = "small dimmed";
    }else{
        /*create an unsorted list with each 
         *route alternative being a new list item*/
        //var udt = document.createElement("div");
        //udt.innerHTML = moment().format("HH:mm:ss") + " (" +  this.lastupdate + ")";
        //wrapper.appendChild(udt);
        var ul = document.createElement("ul");
        var Nrs = 0; //number of routes
        var routeArray = []; //array of all alternatives for later sorting
        for(var routeKey in this.data.routes) {
            /*each route describes a way to get from A to Z*/
            //if(Nrs >= this.config.maxAlternatives){
            //  break;
            //}
            var route = this.data.routes[routeKey];
            var li = document.createElement("li");
            li.className = "small";
            var arrival = 0;
            if (this.config.maxModuleWidth > 0){
              li.style.width = this.config.maxModuleWidth + "px";
            }
            for(var legKey in route.legs) {
                var leg = route.legs[legKey];
                arrival = leg.arrival_time.value;
                var tmpwrapper = document.createElement("text");
                for(var stepKey in leg.steps) {
                    /*each leg consists of several steps
                     *e.g. (1) walk from A to B, then 
                           (2) take the bus from B to C and then 
                           (3) walk from C to Z*/
                    var step = leg.steps[stepKey];
                    this.renderStep(tmpwrapper, step);
                    if (tmpwrapper.innerHTML == "too far"){
                        //walking distance was too long -> skip this option
                        break;
                    }       
                }
                if (tmpwrapper.innerHTML == "too far"){
                    //walking distance was too long -> skip this option
                    li.innerHTML = "too far";
                    break;
                }
                this.renderLeg(li, leg);
                li.appendChild(tmpwrapper);
            }
            if (li.innerHTML != "too far"){
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
  }

});

