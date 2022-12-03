# LCOV to Cobertura XML Converter

Converts code coverage report files in LCOV format to Cobertura's XML report format so that CI servers like Jenkins can aggregate results
and determine build stability etc.

**This project is based on <a href="https://github.com/eriwen/lcov-to-cobertura-xml">https://github.com/eriwen/lcov-to-cobertura-xml</a>, if
you like this project please consider supporting that one as well.**

## Installing

```shell
deno install --allow-read --allow-write https://deno.land/x/lcov_cobertura/mod.ts
```

## Use without installing

```shell
deno run --allow-read --allow-write https://deno.land/x/lcov_cobertura/mod.ts
```

## Usage

### Options

```
Usage: lcov_cobertura <file>

Options:
    -h, --help                  - Show this help.
    -V, --version               - Show the version number for this program.
    -b, --base-dir  <baseDir>   - Directory where source files are located                (Default: ".")
    -e, --excludes  <excludes>  - Comma-separated list of regexes of packages to exclude
    -o, --output    <output>    - Path to store Cobertura XML file
```

## Attribution

<a href="https://www.flaticon.com/free-icon/insurance_2300473">Repository icon created by mavadee and distributed by Flaticon</a>
