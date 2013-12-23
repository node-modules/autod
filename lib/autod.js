/*!
 * autod - lib/autod.js
 * Copyright(c) 2013 
 * Author: dead_horse <undefined>
 */

'use strict';

/**
 * Module dependencies.
 */

var fs = require('fs');
var path = require('path');
var debug = require('debug')('autod');
var bagpipe = require('bagpipe');
var eventproxy = require('eventproxy');
var urllib = require('urllib');

var Autod = function (options) {
  if (!(this instanceof Autod)) {
    return new Autod(options);
  }

  this.root = options.root;
  if (!this.root) {
    throw new Error('need options.root!');
  }

  this.exclude = options.exclude || [];
  if (!Array.isArray(this.exclude)) {
    this.exclude = [this.exclude];
  }
  this.exclude.push('node_modules');
  this.exclude.push('.git');
  this.testRoot = options.testRoot || 'test';
  this.registry = options.registry || 'http://registry.cnpmjs.org';
};

/**
 * @api private
 */
Autod.prototype.findJsFile = function (root, exclude) {
  root = path.resolve(root);
  //exclude path
  exclude = exclude || [];
  if (!Array.isArray(exclude)) {
    exclude = [exclude];
  }
  var excludeMap = {};
  exclude.forEach(function (e) {
    excludeMap[path.resolve(e)] = 1;
  });
  debug('exclude file path: %j', Object.keys(excludeMap));

  function parseDir(dir) {
    if (!dir) {
      return {
        dirs: [],
        jsFiles: []
      };
    }
    dir = path.resolve(dir);
    var files = [];
    var dirs = [];
    var jsFiles = [];
    try {
      files = fs.readdirSync(dir);
    } catch (err) {
      return files;
    }

    files.forEach(function (file) {
      var filePath = path.join(dir, file);
      if (excludeMap[filePath] === 1) {
        return {
          dirs: dirs,
          jsFiles: jsFiles
        };
      }
      var stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return dirs.push(filePath);
      }
      if (path.extname(file) === '.js') {
        jsFiles.push(filePath);
      }
    });
    return {
      dirs: dirs,
      jsFiles: jsFiles
    };
  }

  var dirs = [root];
  var jsFiles = [];
  do {
    var result = parseDir(dirs.pop());
    jsFiles = jsFiles.concat(result.jsFiles);
    dirs = dirs.concat(result.dirs);
  } while(dirs.length);
  return jsFiles;
};

/**
 * @api private
 */
Autod.prototype.parseFile = function (filePath) {
  var file;
  try {
    file = fs.readFileSync(filePath, 'utf-8');  
  } catch (err) {
    console.error('parse file %s error', filePath);
    return [];
  }

  var requireReg = /require\(['"]([a-zA-Z\.\-\_]+)['"]\)/g;
  var parsed;
  var modules = [];
  while (parsed = requireReg.exec(file)) {
    modules.push(parsed[1]);
  }
  debug('file %s get modules %j', filePath, modules);
  return modules;
};

/**
 * @api private
 */
Autod.prototype.requestNpm = function (name, callback) {
  var url = this.registry + '/' + name + '/latest';
  var options = {
    headers: {
      'user-agent': 'autod-check'
    }
  };

  urllib.request(url, options, function (err, result) {
    var errmsg = '';
    if (err) {
      return callback(err);
    }
    try {
      result = JSON.parse(result);
    } catch (e) {
      errmsg = 'parse origin package info error. ' + err.message;
      return callback(new Error(err.message));
    }
    var remoteVersion = result && result.version || 'unknow';
    return callback(null, remoteVersion);
  });
};

/**
 * @api private
 */
Autod.prototype.listVersions = function (deps, callback) {
  if (!deps.length) {
    callback(null, {});
  }
  var self = this;
  var queue = new bagpipe(5);
  var count = deps.length;
  var versions = {};
  function done() {
    if (--count === 0) {
      debug('list versions get %j', versions);
      return callback(null, versions);
    }
  }

  deps.forEach(function (name) {
    queue.push(self.requestNpm.bind(self), name, function (err, version) {
      if (err) {
        console.error('get %s remote version error: %s', name, err.message);
      } else {
        versions[name] = version;
      }
      done();
    });
  });
};

/**
 * @api public
 */
Autod.prototype.parse = function (callback) {
  var depExclude = this.exclude.concat([this.testRoot]);
  var self = this;
  var ep = eventproxy.create();
  ep.fail(callback);

  function getDeps(files) {
    var depMap = {};
    files.forEach(function (file) {
      self.parseFile(file).forEach(function (dep) {
        depMap[dep] = 1;
      });
    });
    return Object.keys(depMap);
  }
  var deps = getDeps(this.findJsFile(this.root, depExclude));
  var devDeps = getDeps(this.findJsFile(this.testRoot));
  
  self.listVersions(deps, ep.doneLater('depVersions'));
  self.listVersions(devDeps, ep.doneLater('devDepVersions'));

  ep.all('depVersions', 'devDepVersions', function (depVersions, devDepVersions) {
    for (var key in devDepVersions) {
      if (depVersions.hasOwnProperty(key)) {
        delete devDepVersions[key];
      }
    }
    callback(null, {
      dependencies: depVersions,
      devDependencies: devDepVersions
    });
  });
};

module.exports = Autod;
