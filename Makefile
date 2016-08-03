
test:
	@./node_modules/.bin/mocha \
		--require should \
		--reporter spec

autod:
	@autod -w --prefix="^"
.PHONY: test
