/**
 * @fileOverview
 *
 *  ___ ___   _   ___  __  __ ___
 * | _ \ __| /_\ |   \|  \/  | __|
 * |   / _| / _ \| |) | |\/| | _|
 * |_|_\___/_/ \_\___/|_|  |_|___|
 *
 * This is the reporter for debugging collections using Newman.
 *
 * @note FOR CONTRIBUTORS
 *
 * The easiest way to read this file is to understand a couple of things
 * 1. The act of breaking the flow is orchestrated by `break-manager` and the same
 *    is setup at the beginning to connect to a newman run's pause/resume functions
 * 2. This module needs `run` object from start event of newman. This may not be available
 *    on older newman versions. The run object is used everywhere as if it exists, and it's
 *    actual value though is set at the far end of this code in the `start` event listener
 * 3. This project uses `semistandard` linting module.
 *
 * In short,
 * (a) actions are attached to break manager using `brk.add`
 * (b) upon break these actions are presented and then decided to move or not
 * (c) read break manager inline documentation to understand how `brk.add` works!
 *
 * To add a new action should be very easy:
 * 1. Add a new function and option using brk.add (note that the definition point in code sets
 *    the order of display, hence keep it somewhere appropriate and not just plonk it at the
 *    end!)
 * 2. This option will be presented on break. Do something in the function you added to brk.add
 *    and when done, call `done`.
 * 3. If you want your action to cause continue or stay in paused state, set it as boolean
 *    value of the 2nd parameter to the `done` function.
 */
const path = require('path');
const colors = require('colors');
const consola = require('consola');
const filesize = require('filesize');

const util = require('./util');
const runtimeUtils = require('./runtime-utils');
const bannerText = require('./banner.js');
const VarTracker = require('./vartracker');
const BreakManager = require('./break-manager');

const print = util.print;
const printlf = util.printlf;

// Standard newman reporter construction interface
module.exports = function JerryReporter (newman, reporterOptions, options) {
  // Announce Jerry in CLI
  // @note that we are not respecting any "silent" flag for Jerry
  printlf(colors.rainbow(bannerText));
  consola.info(`Loaded Newman Jerry Reporter v${require(path.join(__dirname, '/package.json')).version}`);
  consola.log(`  You can press ${colors.bold('CTRL+C')} any moment to break the run.\n`);

  const brk = new BreakManager();
  const trk = new VarTracker(); // \_(ツ)_/¯ on name!

  let run, // is assigned only after `start` event
    latestNetwork;

  brk.add(`Break on ${colors.bold('next request')}`, function (done) {
    newman.once('request', function () {
      brk.break('request');
    });

    done(null, true);
  });

  brk.add(`Break on ${colors.bold('next iteration')}`, function (done) {
    newman.once('beforeIteration', function () {
      brk.break('iteration start');
    });

    done(null, true);
  });

  brk.add(`Break on ${colors.bold('next console log')}`, function (done) {
    newman.once('console', function () {
      brk.break('console log');
    });

    done(null, true);
  });

  brk.add(`Break on ${colors.bold('the end of run')}`, function (done) {
    newman.on('iteration', function (arg0, args) { // arg0 is error, we have no business handling
      if (args.cursor.eof) {
        brk.break('end of run');
      }
    });

    done(null, true);
  });

  brk.add(`Break on ${colors.bold('variable change')}`, function (done) {
    const onChangeTracker = function () {
      const col = trk.track('Collection');
      const env = trk.track('Environment');
      const glb = trk.track('Global');

      if (env.modified || glb.modified || col.modified) {
        newman.off('item', onChangeTracker);
        VarTracker.printStatusLists(col, env, glb);

        brk.break('change of variable');
      }
    };

    newman.on('item', onChangeTracker);

    done(null, true);
  });

  brk.add(`Break on ${colors.bold('setNextRequest')}`, function (done) {
    let latestSNR;

    const sniffSNR = function (err, o) {
      if (err) {
        return;
      }

      const snr = runtimeUtils.extractSNR(o.executions);

      if (snr) {
        latestSNR = snr;
      }
    };

    const reactToSNRChange = function (arg0, o) { // arg0 is error, we have no business handling
      if (latestSNR) {
        newman.off('test', sniffSNR);
        newman.off('item', reactToSNRChange);
        brk.break('change of execution order');
      }
    };

    newman.on('test', sniffSNR);
    newman.on('item', reactToSNRChange);

    done(null, true);
  });

  brk.add('Inspect all variables', function (done) {
    VarTracker.printLists(VarTracker.list(run.state.collectionVariables),
      VarTracker.list(run.state.environment), VarTracker.list(run.state.globals));

    done(null, false);
  });

  brk.add('Show last network activity', function (done) {
    consola.log('');

    if (!latestNetwork) {
      consola.info('No last recorded network activity');
      return done(null, false);
    }

    if (latestNetwork.err) {
      consola.error(latestNetwork.err);
      return done(null, false);
    }

    const req = latestNetwork.req;
    const res = latestNetwork.res;
    const mime = res.contentInfo();

    const SEP = colors.gray('★ ');

    print(`${req.method} ${req.url}\n`);

    print(`${res.code} ${res.reason()} ${SEP}`);
    print(`${util.prettyms(res.responseTime)} ${colors.gray('time')} ${SEP}`);
    print(`${filesize(req.size().total, { spacer: '' })}${colors.gray('↑')} ${filesize(res.size().total, { spacer: '' })}${colors.gray('↓')} ${colors.gray('size')} ${SEP}`);
    print(`${req.headers.members.length}${colors.gray('↑')} ${res.headers.members.length}${colors.gray('↓')} ${colors.gray('headers')} ${SEP}`);
    print(`${res.cookies.members.length} ${colors.gray('cookies')}\n\n`);

    // @todo add auth 🔒 snippet

    print(`${mime.fileName} ${SEP}`);
    print(`${mime.contentType} ${SEP}`);
    print(`${mime.mimeType} ${SEP}`);
    print(`${mime.mimeFormat} ${SEP}`);
    print(`${mime.charset}\n`);
    print(colors.gray(res.text()) + '\n');

    return done(null, false);
  });

  newman.on('request', function (err, args) {
    latestNetwork = {
      err: err,
      req: args.request,
      res: args.response
    };
  });

  newman.on('done', function () {
    latestNetwork = null;
  });

  brk.add('Abort run', function (done) {
    if (run) {
      run.abort();
    }

    done(null, true);
  });

  brk.add('Force abort run (press ESC)', function () {
    process.exit(1);
  });

  newman.on('start', function (err, args) {
    if (err) {
      consola.warn('Unable to initialise Jerry. There was an error during run start.\n' +
                colors.gray('This is unlikely because of Jerry and most likely because of a bug in some reporter or ' +
                'a bug in Newman itself. Having said that, the error described below could be a clue ' +
                'leading to the cause.'));
      consola.error(err);
      return;
    }

    if (!(args && args.run)) {
      consola.warn('Unable to initialise Jerry. Could not integrate accurately with Newman.\n' +
                colors.gray('This is likely because you are running an older version of Newman that is not capable ' +
                'of exposing appropriate internal interfaces. Try re-running by upgrading Newman to the latest ' +
                'version using `npm i newman@latest` command.'));
      return;
    }

    run = args.run;

    // break manager is required to be setup before use. whenever continue or break
    // is triggered, we pause or resume the run.
    brk.setup({
      onBreak: function (done) {
        run.pause(done);
      },
      onContinue: function (done) {
        run.resume(done);
      },
      signal: true // mark that ctrl+c will be hijacked
    });

    // setup all the trackers for variables in the run (setting `true` does one initial tracking)
    trk.attach('Collection', run.state.collectionVariables, true);
    trk.attach('Environment', run.state.environment, true);
    trk.attach('Global', run.state.globals, true);

    if (!reporterOptions.continueOnStart) {
      brk.break('execution start');
    }
  });

  newman.on('done', function (err) {
    if (!run) { return; } // implies newman was older than needed

    if (err) {
      consola.error(err);
    }

    consola.info('Newman execution completed.');
  });
};
