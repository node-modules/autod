'use strict';

const coffee = require('coffee');
const assert = require('assert');
const path = require('path');

const autod = require.resolve('../bin/autod.js');

describe('autod', () => {
  it('should output when dependencies missing', () => {
    const cwd = path.join(__dirname, 'fixtures/check-pkg');
    return coffee.fork(autod, [ '--prefix=^' ], { cwd })
      .debug()
      .expect('code', 0)
      .expect('stdout', /debug\s+-\s+\^.*/)
      .expect('stdout', /urllib\s+-/)
      .end();
  });

  it('should output when dependencies need upgrade', () => {
    const cwd = path.join(__dirname, 'fixtures/upgrade');
    return coffee.fork(autod, [ '--prefix=^' ], { cwd })
      .debug()
      .expect('code', 0)
      .expect('stdout', /debug\s+1\s+\^.*/)
      .end();
  });

  it('should support import', () => {
    const cwd = path.join(__dirname, 'fixtures/import');
    return coffee.fork(autod, [ '--prefix=^' ], { cwd })
      .debug()
      .expect('code', 0)
      .expect('stdout', /debug\s+-\s+\^.*/)
      .end();
  });

  it('should support add test dir', () => {
    const cwd = path.join(__dirname, 'fixtures/check-pkg');
    return coffee.fork(autod, [ '--prefix=^', '--test=index.js' ], { cwd })
      .debug()
      .expect('code', 0)
      .expect('stdout', /nothing to update in Dependencies/)
      .expect('stdout', /debug\s+-\s+\^.*/)
      .end();
  });

  it('should support add exclude dir', function* () {
    const cwd = path.join(__dirname, 'fixtures/exclude');
    const res = yield coffee.fork(autod, [ '--prefix=^', '--exclude=**/fixtures' ], { cwd })
      .debug()
      .expect('code', 0)
      .end();
    assert(!res.stdout.match(/egg/));
  });

  it('should support add semver', () => {
    const cwd = path.join(__dirname, 'fixtures/check-pkg');
    return coffee.fork(autod, [ '--prefix=^', '--semver=debug@1' ], { cwd })
      .debug()
      .expect('code', 0)
      .expect('stdout', /debug\s+-\s+\^1.*/)
      .expect('stdout', /urllib\s+-/)
      .end();
  });

  it('should support add keep', function* () {
    const cwd = path.join(__dirname, 'fixtures/check-pkg');
    const res = yield coffee.fork(autod, [ '--prefix=^', '--keep=debug' ], { cwd })
      .debug()
      .expect('code', 0)
      .end();
    assert(!res.stdout.match(/debug/));
  });
});
