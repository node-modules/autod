/*!
 * autod - lib/autod.js
 * Copyright(c) 2013
 * Author: dead_horse <dead_horse@qq.com> (http://deadhorse.me)
 */

'use strict';

/**
 * Module dependencies.
 */

var EventEmitter = require('events').EventEmitter;
var debug = require('debug')('autod');
var crequire = require('crequire');
var babel = require('babel-core');
var bagpipe = require('bagpipe');
var pkg = require('./package');
var semver = require('semver');
var urllib = require('urllib');
var path = require('path');
var util = require('util');
var fs = require('fs');

var MODULE_REG = /^(@[0-9a-zA-Z\-\_][0-9a-zA-Z\.\-\_]*\/)?([0-9a-zA-Z\-\_][0-9a-zA-Z\.\-\_]*)/;

var Autod = function (options) {
  if (!(this instanceof Autod)) {
    return new Autod(options);
  }
  options = options || {};
  if (!options.root) {
    throw new Error('need options.root!');
  }
  this.root = path.resolve(options.root);

  EventEmitter.call(this);

  this.exclude = options.exclude || [];
  if (!Array.isArray(this.exclude)) {
    this.exclude = [this.exclude];
  }

  this.exclude = this.exclude.concat(['node_modules', '.git', 'cov', 'coverage']);
  this.exclude = this.resolveWithRoot(this.exclude);
  this.testRoots = options.test || [];
  this.testRoots = this.testRoots.concat(['test', 'benchmark', 'example', 'example.js']);
  this.testRoots = this.resolveWithRoot(this.testRoots);
  this.testRoots = this.removeExclude(this.testRoots);
  this.registry = (options.registry || 'https://registry.npmjs.org').replace(/\/$/, '');
  this.dep = options.dep || [];
  this.devdep = options.devdep || [];
  this.dependencyMap = {};
  this.semver = options.semver || {};
  this.notransform = options.notransform;
  if (options.plugin) {
    try {
      var pluginPath = path.join(process.cwd(), 'node_modules', options.plugin);
      this.plugin = require(pluginPath);
    } catch (err) {
      throw new Error('plugin ' + options.plugin + ' not exist!');
    }
  }
};

util.inherits(Autod, EventEmitter);

/**
 * @api private
 */
Autod.prototype.findJsFile = function (root, exclude) {
  try {
      if (fs.statSync(root).isFile()) {
      return [root];
    }
  } catch (err) {
    // ignore
  }

  //exclude path
  exclude = exclude || [];
  if (!Array.isArray(exclude)) {
    exclude = [exclude];
  }
  var excludeMap = {};
  exclude.forEach(function (e) {
    excludeMap[e] = 1;
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
      if (!extname || extname === '.js' || extname === '.jsx') {
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
    if (!this.notransform) {
      var res = babel.transform(file, {
        presets: [require('babel-preset-react'), require('babel-preset-es2015'), require('babel-preset-stage-0')],
      });
      file = res.code;
    }
  } catch (err) {
    this.emit('warn', util.format('Read(or transfrom) file %s error', filePath));
  }
  var modules = [];
  var self = this;

  crequire(file, true).forEach(function (r) {
    var parsed = MODULE_REG.exec(r.path);
    if (!parsed) {
      return;
    }
    var scope = parsed[1];
    var name = parsed[2];
    if (scope) {
      name = scope + name;
    }
    modules.push(name);
    self.dependencyMap[name] = self.dependencyMap[name] || [];
    self.dependencyMap[name].push(filePath);
  });

  // support plugin parse file
  if (this.plugin) {
    var pluginModules = this.plugin(filePath, file) || [];
    pluginModules.forEach(function (name) {
      modules.push(name);
      self.dependencyMap[name] = self.dependencyMap[name] || [];
      self.dependencyMap[name].push(filePath);
    })
  }

  debug('file %s get modules %j', filePath, modules);
  return modules;
};

Autod.USER_AGENT = 'autod-check/' + pkg.version + ' ' + urllib.USER_AGENT;

/**
 * @api private
 */
Autod.prototype.requestNpmTag = function (name, tag, callback) {
  if (typeof tag === 'function') {
    callback = tag;
    tag = 'latest';
  }

  var url = this.registry + '/' + name + '/' + tag;
  var options = {
    headers: {
      'user-agent': Autod.USER_AGENT,
    },
    gzip: true,
    timeout: 10000
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
      return callback(new Error('no match remote version with tag ' + tag));
    }
    callback(null, remoteVersion);
  });
};

Autod.prototype.requestNpmAll = function (name, range, callback) {
  var url = this.registry + '/' + name;
  var options = {
    headers: {
      'user-agent': Autod.USER_AGENT,
    },
    gzip: true,
    timeout: 10000
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

    if (!result.versions) {
      return callback(new Error('can not get versions of ' + name));
    }

    var version = semver.maxSatisfying(Object.keys(result.versions), range);
    if (!version) {
      var msg = util.format('can not found any match version of %s with range of %s', name, range);
      return callback(new Error(msg));
    }

    return callback(null, version);
  });
}

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
    var tag = 'latest';
    var handler = self.requestNpmTag.bind(self);

    var inputTag = self.semver[name];
    if (inputTag) {
      if (semver.validRange(inputTag)) handler = self.requestNpmAll.bind(self);
      tag = inputTag;
    }

    queue.push(handler, name, tag, function (err, version) {
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
 * @api private
 */
Autod.prototype.resolveWithRoot = function(dirs) {
  return dirs.map(function (dir) {
    return path.resolve(this.root, dir);
  }, this);
};

Autod.prototype.removeExclude = function(dirs) {
  return dirs.filter(function (dir) {
    return this.exclude.indexOf(dir) === -1;
  }, this);
};

/**
 * @api public
 */
Autod.prototype.parse = function (callback) {
  var depExclude = this.exclude.concat(this.testRoots);
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
  deps = deps.concat(this.dep);

  var devDeps = [];
  this.testRoots.forEach(function (testRoot) {
    devDeps = devDeps.concat(getDeps(this.findJsFile(testRoot, this.exclude)));
  }.bind(this));
  // add devdeps input
  devDeps = devDeps.concat(this.devdep);

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
