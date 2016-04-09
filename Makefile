
test:
	@./node_modules/.bin/mocha \
		--require should \
		--reporter spec

autod:
	@autod -w --prefix="~" -d babel-preset-react,babel-plugin-transform-es2015-modules-commonjs
.PHONY: test
