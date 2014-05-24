
test:
	@./node_modules/.bin/mocha \
		--require should \
		--reporter spec

autod:
	@./bin/autod -w --prefix="~"
.PHONY: test
