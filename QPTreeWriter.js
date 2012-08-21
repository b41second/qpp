// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var QPTreeWriter = (function() {
  'use strict';
  
  var debug = false;

  var ParseTreeMapWriter = traceur.outputgeneration.ParseTreeMapWriter;
  var SourceMapGenerator = traceur.outputgeneration.SourceMapGenerator;

    /**
   * Converts a ParseTree to text and a source Map
   * @param {ParseTree} highlighted
   * @param {boolean} showLineNumbers
   * @param { {SourceMapGenerator} sourceMapGenerator
   * @constructor
   */
  function QPTreeWriter(generatedSourceName, tracequeries) {
    var config = {file: generatedSourceName};
    this.sourceMapGenerator = new SourceMapGenerator(config);
    ParseTreeMapWriter.call(this, false, false, this.sourceMapGenerator);
    
    this._tracequeries = tracequeries;
  }


  QPTreeWriter.prototype = traceur.createObject(
      ParseTreeMapWriter.prototype, {

        generateSource: function(tree) {
          this.visitAny(tree);
          if (this.currentLine_.length > 0) {
            this.writeln_();
          }

          return { 
              sourceMap: this.sourceMapGenerator.toString(),
              generatedSource: this.result_.toString()
          };
        },
        
        /**
         * @param {ParseTree} tree
         */
        visitAny: function(tree) {
            if (tree) {
              ParseTreeMapWriter.prototype.visitAny.call(this, tree);
              if (debug) console.log("visitAny tree location " + (tree.location ? tree.location.start.offset + '-' + tree.location.end.offset : "null location"));
            }
        },

        writeln_: function() {
          if (debug) console.log("current line "+this.currentLine_);
          ParseTreeMapWriter.prototype.writeln_.call(this);
          if (this.currentLocation) {
            var trace = this._tracequeries.getTraceSource(this.previousLocation, this.currentLocation);
            if (trace) {
              console.log("found matching tracequery, write tracing code "+trace);
              this.currentLine_ = trace;
              ParseTreeMapWriter.prototype.writeln_.call(this);
            }
            this.previousLocation = this.currentLocation;
          } // else generated by a transformation
        }

  });

  return QPTreeWriter;

})();