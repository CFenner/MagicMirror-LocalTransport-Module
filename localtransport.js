/* global Module */
/* Magic Mirror
 * Module: localtransport
 *
 * By Christopher Fenner https://github.com/CFenner
 * MIT Licensed.
 */
Module.register('localtransport', {
  defaults: {
    animationSpeed: 1,
    updateInterval: 5,
    mode: 'transit',
    traffic_model: 'best_guess',
    departure_time: 'now',
    language: 'de',
    units: 'metric',
    alternatives: true,
    maxAlternatives: 3,
    absoluteTime: false,
    showDuration: false,
    apiBase: 'https://maps.googleapis.com/',
    apiEndpoint: 'maps/api/directions/json'
  },
  start: function() {
      Log.info('Starting module: ' + this.name);
      this.loaded = false;
      this.url = this.config.apiBase + this.config.apiEndpoint + this.getParams();
      this.update();
  		// refresh every x minutes
  		setInterval(
  			this.update.bind(this),
  			this.config.updateInterval * 60 * 1000);
  },
  update: function() {
      this.sendSocketNotification(
        'LOCAL_TRANSPORT_REQUEST',
        this.config.apiBase + this.config.apiEndpoint + this.getParams());
  },
  getParams: function() {
      var params = '?';
      params += 'mode=' + this.config.mode;
      params += '&origin=' + this.config.origin;
      params += '&destination=' + this.config.destination;
      params += '&key=' + this.config.api_key;
      params += '&traffic_model=' + this.config.traffic_model;
      params += '&departure_time=' + this.config.departure_time; 
      params += '&alternatives=' + this.config.alternatives;
      return params;
  },
  renderLeg: function(wrapper, leg){
    var depature = leg.departure_time.value * 1000;
    var arrival = leg.arrival_time.value * 1000;
    var span = document.createElement("div");
    if (!this.config.absoluteTime) {
      span.innerHTML = moment(depature).fromNow() 
    } else {
      if (config.timeFormat !== 24) {
        span.innerHTML = this.translate('ABSOLUTE_PREFIX') + moment(depature).format('h:mm A') 
      } else {
        span.innerHTML = this.translate('ABSOLUTE_PREFIX') + moment(depature).format('HH:mm') 
      }
    }
    if (this.config.showDuration) {
      span.innerHTML += "(" + moment.duration(moment(arrival).diff(depature, 'minutes'), 'minutes').humanize() + ")";
    }
      // + this.translate('TRAVEL_TIME') + ": "
      // + moment.duration(moment(arrival).diff(depature, 'minutes'), 'minutes').humanize()
      ;
    wrapper.appendChild(span);
  },
  renderStep: function(wrapper, step){
    if(step.travel_mode === "WALKING"){
      return; // skip walking
    }
    var details = step.transit_details;
    if(details) {
      var img = document.createElement("img");
      img.src = details.line.vehicle.local_icon || ("http:" + details.line.vehicle.icon);
      wrapper.appendChild(img);
      var span = document.createElement("span");
      span.innerHTML = details.line.short_name || details.line.name;
      span.className = "bright";
      wrapper.appendChild(span);
    }
  },
  socketNotificationReceived: function(notification, payload) {
      if (notification === 'LOCAL_TRANSPORT_RESPONSE') {
          Log.info('received' + notification);
          if(payload && payload.status === "OK"){
            this.data = payload;
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
    var wrapper = document.createElement("div");
    if (!this.loaded) {
      wrapper.innerHTML = this.translate("LOADING_CONNECTIONS");
    }else{
      var ul = document.createElement("ul");
      for(var routeKey in this.data.routes) {
        if(Number(routeKey) >= this.config.maxAlternatives){
          break;
        }
        var route = this.data.routes[routeKey];
        var li = document.createElement("li");
        for(var legKey in route.legs) {
          var leg = route.legs[legKey];
          for(var stepKey in leg.steps) {
            var step = leg.steps[stepKey];
              this.renderStep(li, step);
          }
          this.renderLeg(li, leg);
        }
        ul.appendChild(li);
      }
      wrapper.appendChild(ul);
    }
    return wrapper;
  }
});
