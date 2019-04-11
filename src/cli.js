const minimist = require('minimist');
const fs = require('fs');
const nodeWatch = require('node-watch');
const SwaggerCombine = require('./SwaggerCombine');
const pkg = require('../package.json');
const url = require('./url');
const server = require("./serve.js");

function CLI(argv) {
  const args = minimist(argv);
  const config = args._[0];
  const output = args.output || args.o;
  const format = args.format || args.f;
  const watch = args.watch || args.w;
  const debug = args.debug;
  const serve = args.serve;
  const host = args.host;
  const port = args.port;
  const opts = {};

  if (args.v) {
    console.info(`v${pkg.version}`);
    return;
  }

  if (args.h) {
    console.info(
      'Usage: swagger-combine <config> [-h] [-v] [--debug] [-o|--output file] [-f|--format <yaml|json>] [--continueOnError] [--continueOnConflictingPaths] [--includeDefinitions] [--skipBeforeRun] [-w|--watch] [--serve --host <localhost> --port <8000>]'
    );
    return;
  }

  if (!config) {
    console.info('No config file in arguments');
    return;
  }

  if ((output && /\.ya?ml$/i.test(output)) || (format && /ya?ml/i.test(format))) {
    opts.format = 'yaml';
  }

  opts.continueOnError = !!args.continueOnError;
  opts.continueOnConflictingPaths = !!args.continueOnConflictingPaths;
  opts.includeDefinitions = !!args.includeDefinitions;
  opts.useBasePath = !!args.useBasePath;
  opts.skipBeforeRun = !!args.skipBeforeRun;

  var combiner = new SwaggerCombine(config, opts);
  return combiner
    .combine()
    .then(combinedSchema => {
      if (output) {
        fs.writeFileSync(output, combinedSchema.toString());
      } else {
        console.info(combinedSchema.toString());
      }
      if (watch) {
        var paths = [];
        combiner.parsers.map(parser => {
          paths = paths.concat(parser.$refs.paths("file"));
        });
        combiner.apis.map(api => {
          if (Array.isArray(api.watch)) {
            api.watch.map(sourceFile => {
              if (url.isFileSystemPath(sourceFile)) {
                paths.push(url.path.resolve(url.resolveRelativePath(config, sourceFile)));
              }
            });
          }
        });

        var watchers = [];

        var fileChangeHandler = function onFileChange(evt, name) {
          console.log('%s changed.', name);
          watchers.map(watcher => {watcher.close();});
          CLI(argv.filter(arg => {return arg.toLowerCase() != "--serve";}));
        };

        var distinctFilesToWatch = new Set(paths);
        distinctFilesToWatch.forEach(path => {
          watchers.push(nodeWatch(path, { recursive: true, persistent: false }, fileChangeHandler));
          if (debug) { console.debug("Watching", path); }
        });
        console.debug("Watching", distinctFilesToWatch.size , "files");

        if (!serve) {
          process.stdin.resume();
        }
      }

      if (serve === true) {
        server.start(
          output,
          output,
          port || "8000",
          host || "127.0.0.1",
          true,
          debug
        );

        process.stdin.resume();

      }

    })
    .catch(error => {
      console.error(error.message)
      process.exit(1);
    });
}

module.exports = CLI;
