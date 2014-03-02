/*!
 * autod - lib/autod.js
 * Copyright(c) 2013
 * Author: dead_horse <dead_horse@qq.com> (http://deadhorse.me)
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
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var REQUIRE_REG = /require\s*\(['"]([0-9a-zA-Z\-\_][0-9a-zA-Z\.\-\_]*)['"]\)/g;

var Autod = function (options) {
  if (!(this instanceof Autod)) {
    return new Autod(options);
  }
  EventEmitter.call(this);
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
  this.dep = options.dep || [];
  this.dependencyMap = {};
};

util.inherits(Autod, EventEmitter);

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
      return {
        dirs: dirs,
        jsFiles: jsFiles
      };
    }

    files.forEach(function (file) {
      var filePath = path.join(dir, file);
      if (excludeMap[filePath] === 1) {
        return;
      }
      var stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return dirs.push(filePath);
      }
      var extname = path.extname(filePath);
      if (!extname || extname === '.js') {
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
  debug('in folder %s exclude %j, get js files: %j',
    root, Object.keys(excludeMap), jsFiles);
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
    this.emit('warn', util.format('Read file %s error', filePath));
    return [];
  }

  var parsed;
  var modules = [];
  var self = this;
  while (parsed = REQUIRE_REG.exec(file)) {
    var name = parsed[1];
    modules.push(name);
    self.dependencyMap[name] = self.dependencyMap[name] || [];
    self.dependencyMap[name].push(filePath);
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
      errmsg = 'parse origin package info error. ' + e.message;
      return callback(new Error(errmsg));
    }
    var remoteVersion = result && result.version;
    if (!remoteVersion) {
      return callback(new Error('no remote version'));
    }
    callback(null, remoteVersion);
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
  var errNames = [];
  function done() {
    if (--count === 0) {
      debug('list versions get %j, error package names: %j', versions, errNames);
      var err = null;
      if (errNames.length) {
        err = new Error(util.format('package %j get remote version error.', errNames));
        err.names = errNames;
      }
      return callback(err, versions);
    }
  }

  deps.forEach(function (name) {
    queue.push(self.requestNpm.bind(self), name, function (err, version) {
      if (err) {
        errNames.push(name);
      } else {
        versions[name] = version;
      }
      done();
    });
  });
};

function union(arrOne, arrTwo) {
  arrOne = arrOne || [];
  arrTwo = arrTwo || [];
  var map = {};
  arrOne.concat(arrTwo).forEach(function (name) {
    map[name] = true;
  });
  return Object.keys(map);
}

/**
 * @api public
 */
Autod.prototype.parse = function (callback) {
  var depExclude = this.exclude.concat([this.testRoot]);
  var self = this;

  function isCoreModule(name) {
    var filename;
    try {
      filename = require.resolve(name);
    } catch (err) {
      return false;
    }
    return filename === name;
  }

  function getDeps(files) {
    var depMap = {};
    files.forEach(function (file) {
      self.parseFile(file).forEach(function (dep) {
        if (!isCoreModule(dep)) {
          depMap[dep] = 1;
        } else {
          delete self.dependencyMap[dep];
        }
      });
    });
    return Object.keys(depMap);
  }
  var deps = getDeps(this.findJsFile(this.root, depExclude));
  // add deps input
  if (this.dep) {
    deps = deps.concat(this.dep);
  }
  var devDeps = getDeps(this.findJsFile(this.testRoot));

  self.listVersions(deps, function (err, depVersions) {
    var isError = false;
    var errNames = [];
    if (err) {
      isError = true;
      errNames = errNames.concat(err.names || []);
    }

    self.listVersions(devDeps, function (err, devDepVersions) {
      if (err) {
        isError = true;
        errNames = union(errNames, err.names);
      }

      for (var key in devDepVersions) {
        if (depVersions.hasOwnProperty(key)) {
          delete devDepVersions[key];
        }
      }

      for (var key in self.dependencyMap) {
        self.dependencyMap[key] = union(self.dependencyMap[key]);
      }

      var result = {
        dependencies: depVersions || {},
        devDependencies: devDepVersions || {},
        map: self.dependencyMap
      };
      if (isError) {
        err = new Error(util.format('package %j get remote version error.', errNames));
        err.map = self.dependencyMap;
        err.names = errNames;
        var errorMap = {};
        errNames.forEach(function (name) {
          errorMap[name] = self.dependencyMap[name];
        });
        err.errorMap = errorMap;
        return callback(err, result);
      }
      callback(null, result);
    });
  });
  return this;
};

module.exports = Autod;
