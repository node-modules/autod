
test:
	@./node_modules/.bin/mocha \
		--require should \
		--reporter spec

autod:
	@./bin/autod.js -w --prefix="~"
.PHONY: test
