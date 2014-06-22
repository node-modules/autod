
# autod

[![NPM](https://nodei.co/npm/autod.svg)](https://nodei.co/npm/autod/)

Auto generate dependencies and devDependencies by parse the project file.
`autod` will parse all the js files in `path`, and get the latest dependencies version from [registry.npm.taobao.org](http://registry.npm.taobao.org) or other registries by `-r`.

## install

```bash
$ npm install -g autod
```

## usage

```bash
$ bin/autod -h

  Usage: autod [options]

  Options:

    -h, --help                           output usage information
    -p, --path [folder path]             the folder path to be parse
    -t, --test <test folder path>        the test folder path to be parse
    -e, --exclude <exclude folder path>  exclude parse folder, split by `,`
    -r, --registry <remote registry>     get latest version from which registry
    -f, --prefix [version prefix]        version prefix, can be `~` or `>=`
    -w, --write                          write dependencies into package.json
    -i, --ignore                         ignore errors, display the dependencies or write the dependencies.
    -m, --map                            display all the dependencies require by which file
    -d, --dep <dependence modules>       modules that not require by file, but you really need them
    -k, --keep <dependencies modules>    modules that you want to keep version in package.json file
```

* Autod will parse all the js files in `path`, and you can exclude folder by `-e, --exclude`.
* All the modules in test folder (can be alter by `-t, --text`) will parsed as devDependencies.
* If you set `-w, --write`, `autod` will write the dependencies into package.json file. `dependencies` will replace `dependencies` in package.json, and `devDependencies` will merge with `devDependencies` in package.json, then write into package file.
* `-f, --prefix` will add prefix to each dependencies' version.
* `-i, --ignore` will display or wrtie the dependencies even some error happened.
* `-d --dep` will add modules to package.json even not require by any file.
* `-k --keep` will keep the modules' version in package.json not change by autod.

## Maintains your dependencies in Makefile

add a command in your Makefile

```sh
autod:
    @./node_modules/.bin/autod -w
    @npm install

```

then run `make autod`, it will find all the dependencies and devDependencies in your project,
add / remove dependencies, and bump the versions.

check out an example [here](https://github.com/cnpm/cnpmjs.org/blob/master/Makefile#L50)

## License

(The MIT License)

Copyright (c) 2013 dead_horse <dead_horse@qq.com>;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
