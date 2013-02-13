// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

// A traceur WebPageProject that delegates XHR to chrome extension background and
// extracts scripts via chrome.inspectedWindow.eval

function RemoteWebPageProject(remoteURL, devtoolsModel) {
  traceur.WebPageProject.call(this, remoteURL);
  this.devtoolsModel = devtoolsModel;
  RemoteWebPageProject.currentProject = this;
  console.log("RemoteWebPageProject created for "+remoteURL);
}

RemoteWebPageProject.onBackgroundMessage_ = function(message) {
  if (this.currentProject) {
    this.currentProject.onBackgroundMessage_(message);
  } else {
    console.log("background message but no current project ", this);  
  }
}.bind(RemoteWebPageProject);

RemoteWebPageProject.postId = 1;
RemoteWebPageProject.postCallbacks = {};
RemoteWebPageProject.xhrFromBackground =  (new RemoteMethodCall.Requestor(XHRInBackground, ChannelPlate.DevtoolsTalker)).serverProxy();
RemoteWebPageProject.debug = true;

RemoteWebPageProject.prototype = Object.create(traceur.WebPageProject.prototype);

// Our page is remote and already loaded.
//
RemoteWebPageProject.prototype.run = function() {
  this.reload();
}

// XSS since we are remote to the web page
//
RemoteWebPageProject.prototype.loadResource = function(url, fncOfContentOrNull) {
  var resource = this.devtoolsModel.getResourceByURL(url);
  if (resource) {
    resource.getContent(fncOfContentOrNull);
    return;
  }

  // mihaip@chromium.org on https://groups.google.com/a/chromium.org/d/msg/chromium-extensions/-/U33r217_Px8J
  // The whitelisting for cross-origin XHRs only happens when running in an extension process. 
  // Your iframe is running inside the devtools process, so it doesn't get that privilege. 
  //You'll need to use the messaging API to ask the extension's background page to fetch the URL 
  // and send the response back to the iframe.
  RemoteWebPageProject.xhrFromBackground.GET(
    [url], 
    function(content) {
      fncOfContentOrNull(content);
    },
    function(err) {
      console.error("XHR Failed for "+url, err);
      fncOfContentOrNull(null);
    }
  );
}

RemoteWebPageProject.prototype.putFiles = function(files) {
  var scripts = files.map(function(file){
    var source = file.generatedSource + "\n//@ sourceURL=" + file.name + '.js';  // .js.js for transcoded files
    return {content: source, originalName: file.name};
  });
  this.putPageScripts(scripts, function(result) {
    if (RemoteWebPageProject.debug) {
      console.log("RemoteWebPageProject compiled " + result.compiled.length + " transcoded scripts", result.compiled);
    }
    result.errors.forEach(function(error) {
      // As far as I can tell the eval does not provide meaningful line numbers for errors.
      var partialContent = error.content;
      console.error(error.message, partialContent);
    });
  });
};



//----------------------------------------------------------------------------------------------------------
// chrome.devtools.inspectedWindow.eval() based script extractor

RemoteWebPageProject.prototype.evalStringify = function(fnc, args) {
  return '(' +fnc.toString() + '(' + JSON.stringify(args) + ')'+ ');'
}

RemoteWebPageProject.prototype.getPageScripts = function(callback) {
  // We can't access the page directly and 
  // script elements with type="application/traceur" are not loaded as devtools resources.

  function getScripts() { // runs in the web page
    var scriptElements = document.querySelectorAll('script');
    var scripts = [];
    for(var i = 0; i < scriptElements.length; i++) {
      var elt = scriptElements[i];
      scripts.push({
        src: elt.src,
        textContent: elt.textContent
      });
    }

    return scripts;
  }

  function onScripts(remoteScripts) { // runs here
    this.remoteScripts = remoteScripts;
    if (RemoteWebPageProject.debug) {
      console.log("RemoteWebPageProject found "+this.remoteScripts.length+" scripts");
    }
    callback();
  }

  chrome.devtools.inspectedWindow.eval(this.evalStringify(getScripts, []), onScripts.bind(this));
};

RemoteWebPageProject.prototype.putPageScripts = function(scripts, callback) {
  
  function putScripts(scripts, debug) { // runs in web page
    var result = {compiled: [], errors: []};
    scripts.forEach(function(script) {
      var content = script.content;
      try {
        eval.call(window, content);  // http://perfectionkills.com/global-eval-what-are-the-options/
        result.compiled.push(script.originalName);
        if (debug) {
          console.log("RemoteWebPageProject.putScripts global eval succeeded " + script.originalName);
        } 
      } catch (exc) {          
        result.errors.push({message: exc.toString(), content: content, stack: exc.stack});
      }
    });
    return result;
  }
  return chrome.devtools.inspectedWindow.eval(this.evalStringify(putScripts, scripts, RemoteWebPageProject.debug), callback);
}
