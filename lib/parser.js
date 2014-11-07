/*
 *
 * https://github.com/seiyugi/debuguy
 *
 * Copyright (c) 2014 seiyugi
 * Licensed under the MPL license.
 */

'use strict';

var fs = require('fs');
var esprima = require('esprima');

var regex = /^(\s*)\/\*\sdebuguy\:\stag\((.+)\)\s*\*\/\n/gm;

var replacer = function _replacer(match, p1, p2) {
  var outputLine = '';
  // the first match
  outputLine = p1 + 'console.log(\'debuguy,\' + (new Date()).getTime()';

  // the debuguy tag arguments
  var args = p2.split(',');

  args.forEach(function (match) {
    match = match.trim();
    outputLine = outputLine + ' + \',\' + ' + match;
  });

  outputLine += ');\n';

  return outputLine;
};

var endsWith = function _endsWith(src, suffix) {
  return src.indexOf(suffix, src.length - suffix.length) !== -1;
};

function esprimaTraversal(src, options) {
  options = options || {};
  options.range = true;

  // abstact syntax tree
  var ast = esprima.parse(src, options);

  var chunks = src.split('');

  var result = {
    toString: function() { return chunks.join(''); }
  };

  function extendNode (node) {
    node.getSource = function () {
      return chunks.slice(node.range[0], node.range[1]).join('');
    };

    node.updateSource = function (text) {
      chunks[node.range[0]] = text;
      for (var i = node.range[0] + 1; i < node.range[1]; i++) {
        chunks[i] = '';
      }
    };
  }

  function esprimaTraversal_traverse(callback) {

    (function traverse (node) {
      extendNode(node);

      Object.keys(node).forEach(function (key) {
        var child = node[key];

        if (Array.isArray(child)) {
          child.forEach(function(grandchild) {
            if (typeof grandchild.type === 'string') {
              traverse(grandchild);
            }
          });
        } else if (child && typeof child.type === 'string') {
          traverse(child);
        }
      });

      callback(node);
    })(ast);

    return result;
  }

  return {
    traverse: esprimaTraversal_traverse
  };
}

var parser = {
  parse: function pr_parse(options) {
    var dir = options.source;
    var out = options.destination;
    var recursive = options.recursive;

    fs.readdir(dir, function(err, list) {
      if (err) {
        console.log(err);
        return;
      }

      dir = endsWith(dir, '/') ? dir : dir + '/';

      out = out || dir;

      fs.exists(out, function(exists) {
        if (!exists) {
          // change it to async mkdir later
          fs.mkdirSync(out);
        }
      });

      list.forEach(function(item) {
        // if the item is a directory
        if (fs.lstatSync(dir + item).isDirectory()) {
          if (recursive) {
            parser.parse({
              source: dir + item,
              recursive: recursive
            });
          }

          return;
        }

        fs.readFile(dir + item, function(err, data) {

          if (err) {
            console.log(err);
            console.log(data);
            return;
          }

          var txt = data.toString();

          // if no match in the file
          if (!txt.match(regex)) {
            return;
          }

          fs.writeFile(out + item, txt.replace(regex, replacer), function(err) {
            if (err) {
              console.log(err);
            } else {
              console.log(out + item + ' was saved!');
            }
          });

        });

      });
    });

  },

  autolog: function pr_autolog(options) {
    var dir = options.source;
    var out = options.destination;
    var recursive = options.recursive;
    // read source folder to find js files
    fs.readdir(dir, function(err, list) {
      if (err) {
        console.log(err);
        return;
      }


      dir = endsWith(dir, '/') ? dir : dir + '/';

      out = out || dir;

      fs.exists(out, function(exists) {
        if (!exists) {
          // change it to async mkdir later
          fs.mkdirSync(out);
        }
      });


      // read each files
      list.forEach(function(item) {
        // if the item is a directory
        if (fs.lstatSync(dir + item).isDirectory()) {
          if (recursive) {
            parser.autolog({
              source: dir + item,
              recursive: recursive
            });

            return;
          }
        }

        //  check file extension is fs
        if (!endsWith(item, 'js')) {
          return;
        }

        fs.readFile(dir + item, function(err, data) {
          console.log('parsing ' + dir + item);

          if (err) {
            console.log(err);
            console.log(data);
            return;
          }

          var text = data.toString();
          var output;

          try {
            output = esprimaTraversal(text, {loc:true})
              .traverse(function (node) {
              if (node.type === 'ArrowFunctionExpression' ||
                  node.type === 'FunctionDeclaration' ||
                  node.type === 'FunctionExpression') {
                var fnoutLine = '\nconsole.log("debuguy,"' +
                  ' + (new Date()).getTime() + ",' +
                  item.substring(0, item.lastIndexOf('.')) + '.' +
                  (node.id ? node.id.name : 'anonymous') + '@' +
                  node.loc.start.line + '");';

                var startLine = node.getSource().indexOf('{') + 1;
                var source = node.getSource().substr(0, startLine) + fnoutLine +
                             node.getSource().substr(startLine);
                node.updateSource(source);
                //console.log(node.id.name);
              }
            });

            fs.writeFile(out + item, output, function(err) {
              if (err) {
                console.log(err);
              } else {
                console.log(out + item + ' was saved!');
              }
            });
          }
          catch (e) {
            console.log('parsing failed: ' + dir + item);
            console.log(e);
          }

        });

      });


    });
  },
};

module.exports = parser;
