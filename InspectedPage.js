// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

// Model of the debuggee based on chrome.devtools callback data

function InspectedPage() {
  chrome.devtools.network.onNavigated.addListener(this.onNavigated.bind(this));
  this.onNavigated();
  this.monitorResources();
  this.monitorNetwork();
}

InspectedPage.debug = false;

InspectedPage.prototype = {

  onNavigated: function(url) {
    this.resources = {}; // API, chrome.devtools.inspectedWindow.Resource by URL
    this.url = url;
    if (url) {
      console.log("onNavigated " + url + '----------------------------');
    }
  },

  monitorResources: function() {
    chrome.devtools.inspectedWindow.onResourceAdded.addListener(this.addResource.bind(this));
    chrome.devtools.inspectedWindow.getResources(function onResources(resources){
      if (InspectedPage.debug) console.log("getResources", resources.map(function(resource){return resource.url}));
      resources.forEach(this.addResource.bind(this));
    }.bind(this));
  },

  addResource: function(resource) {
    if (InspectedPage.debug) console.log("addResource " + resource.url + ' to ' + Object.keys(this.resources).length + " resources");
    this.resources[resource.url] = resource;
  },

  getResources: function() {
    return Object.keys(this.resources).map(function(key) { 
      return this.resources[key];
    }.bind(this));
  },

  getResourceByURL: function(url) {
    return this.resources[url];
  },

  monitorNetwork: function() {
    this.refreshHAR();
    chrome.devtools.network.onRequestFinished.addListener(function onRequestFinished(harEntry){
      if (InspectedPage.debug) console.log("onRequestFinished", harEntry);
    }.bind(this));
  },

  refreshHAR: function() {
    chrome.devtools.network.getHAR(function onHAR(harLog) {
      if (InspectedPage.debug) console.log("onHAR", harLog);
    }.bind(this));
  }
};