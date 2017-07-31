'use strict';

const coffee = require('coffee');
const path = require('path');

const autod = require.resolve('../bin/autod.js');

describe('autod --check', () => {
  it('should exit code 1 when dependencies missing', () => {
    const cwd = path.join(__dirname, 'fixtures/check-pkg');
    return coffee.fork(autod, [ '--check' ], { cwd })
      .debug()
      .expect('code', 1)
      .expect('stderr', /\[ERROR\] Missing dependencies: \["debug"\]/)
      .expect('stderr', /\[ERROR\] Missing devDependencies: \["urllib"\]/)
      .end();
  });

  it('should exit code 0 when dependencies exists', () => {
    const cwd = path.join(__dirname, 'fixtures/check-pkg-pass');
    return coffee.fork(autod, [ '--check' ], { cwd })
      .debug()
      .expect('code', 0)
      .end();
  });
});
