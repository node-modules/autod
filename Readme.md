
# autod

[![NPM](https://nodei.co/npm/autod.png)](https://nodei.co/npm/autod/)

Auto generate dependencies and devDependencies by parse the project file.  
`autod` will parse all the js files in `path`, and get the latest dependencies version from [cnpm](http://registry.cnpmjs.org) or other registries by `-r`.

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
```

* Autod will parse all the js files in `path`, and you can exclude folder by `-e, --exclude`. 
* All the modules in test folder (can be alter by `-t, --text`) will parsed as devDependencies.
* If you set `-w, --write`, `autod` will write the dependencies into package.json file. `dependencies` will replace `dependencies` in package.json, and `devDependencies` will merge with `devDependencies` in package.json, then write into package file.
* `-f, --prefix` will add prefix to each dependencies' version.
* `-i, --ignore` will display or wrtie the dependencies even some error happened.  
 
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
