const Table = require('cli-table3'),
    colors = require('colors'),
    consola = require('consola'),
    filesize = require('filesize'),
    prettyms = require('pretty-ms'),

    bannerText = require('./banner.js'),
    VarTracker = require('./vartracker'),
    BreakManager = require('./break-manager');

const forEachRight = ((arr, callback) => arr
            .slice().reverse().forEach(callback)),

    print = function () {
        return process.stdout.write(...arguments);
    },

    timeUnit = function (ms) {
        if (ms < 1) {
            return `${parseInt(ms * 1000, 10)}µs`;
        }

        return (ms < 1998) ? `${parseInt(ms, 10)}ms` : prettyms(ms || 0);
    },

    extractSNR = function (executions) {
        var snr;

        // eslint-disable-next-line lodash/collection-method-value
        Array.isArray(executions) && forEachRight(executions, function (execution) {
            var nextReq = (execution && execution.result && 
                    execution.result.return && execution.result.return.nextRequest);

            if (nextReq) {
                snr = nextReq;
                return false;
            }
        });

        return snr;
    };

// Standard newman reporter construction interface
module.exports = function JerryReporter (newman, reporterOptions, options) {
    console.log(colors.rainbow(bannerText));

    consola.info(`Loaded Newman Jerry Reporter v${require(__dirname + '/package.json').version}`);
    consola.log(`  You can press ${colors.bold('ctrl+c')} any moment to break the run.\n`);

    let run,
        latestNetwork;

    const trackVariables = Boolean(reporterOptions.trackVars),
        breaker = new BreakManager(),
        variableTracker = new VarTracker();

    breaker.setup({
        onBreak: function (done) {
            run.pause(done);
        },
        onContinue: function (done) {
            run.resume(done);
        }
    });

    breaker.add(`Continue (press ${colors.bold('ctrl+c')} to break)`, function (done) {
        done(null, true);
    });

    breaker.add(`Break on ${colors.bold('next request')}`, function (done) {
        newman.once('request', function () {
            breaker.break('request');
        });

        done(null, true);
    });

    breaker.add(`Break on ${colors.bold('next iteration')}`, function (done) {
        newman.once('beforeIteration', function () {
            breaker.break('iteration start');
        });
        
        done(null, true);
    });

    breaker.add(`Break on ${colors.bold('next console log')}`, function (done) {
        newman.once('console', function () {
            breaker.break('console log');
        });
        
        done(null, true);
    });

    breaker.add(`Break on ${colors.bold('run end')}`, function (done) {
        newman.on('iteration', function (err, args) {
            if (args.cursor.eof) {
                breaker.break('end of run');
            }
        });
        
        done(null, true);
    });

    breaker.add(`Break on ${colors.bold('variable change')}`, function (done) {
        let onChangeTracker = function () {
            let col = variableTracker.track('Collection'),
                env = variableTracker.track('Environment'),
                glb = variableTracker.track('Global');

            if (env.modified || glb.modified || col.modified) {
                newman.off('item', onChangeTracker);

                let table = new Table({ head: ['Status', 'Name', 'Value', 'Scope'] });
                table.push(...col);
                table.push(...env);
                table.push(...glb);
                console.log(table.toString());

                breaker.break('change of variable');
            }
        };

        newman.on('item', onChangeTracker);
        
        done(null, true);
    });

    breaker.add(`Break on ${colors.bold('setNextRequest')}`, function (done) {
        let latestSNR;

        let sniffSNR = function (err, o) {
                if (err) {
                    return;
                }

                let snr = extractSNR(o.executions);

                if (snr) {
                    latestSNR = snr;
                }
            },

            reactToSNRChange = function (err, o) {
                if (latestSNR) {
                    newman.off('test', sniffSNR);
                    newman.off('item', reactToSNRChange);
                    breaker.break(`change of flow`);
                }
            };

        newman.on('test', sniffSNR);
        newman.on('item', reactToSNRChange);

        done(null, true);

    });

    breaker.add('Inspect all variables', function (done) {
        let table = new Table({ head: ['Name', 'Value', 'Scope'] });

        table.push(...VarTracker.list(run.state.collectionVariables, 'Collection'));
        table.push(...VarTracker.list(run.state.environment, 'Environment'));
        table.push(...VarTracker.list(run.state.globals, 'Global'));
        console.log(table.toString());
        
        done(null, false);
    });

    breaker.add('Show last network activity', function (done) {
        consola.log('');

        if (!latestNetwork) {
            consola.info(`No last recorded network activity`);
            return done(null, false);
        }

        if (latestNetwork.err) {
            consola.error(err);
            return done(null, false);
        }

        let req = latestNetwork.req,
            res = latestNetwork.res,
            mime = res.contentInfo();

        const SEP = colors.gray('★ ');

        print(`${req.method} ${req.url}\n`);

        print(`${res.code} ${res.reason()} ${SEP}`)
        print(`${timeUnit(res.responseTime)} ${colors.gray('time')} ${SEP}`);
        print(`${filesize(req.size().total, {spacer: ''})}${colors.gray('↑')} ${filesize(res.size().total, {spacer: ''})}${colors.gray('↓')} ${colors.gray('size')} ${SEP}`);
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

    breaker.add('Force abort run', function (done) {
        process.exit(1);
        done(null, true);
    });

    breaker.add('Abort run', function (done) {
        run.abort();
        done(null, true);
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
        
        variableTracker.attach('Collection', run.state.collectionVariables);
        variableTracker.track('Collection');

        variableTracker.attach('Environment', run.state.environment);
        variableTracker.track('Environment');

        variableTracker.attach('Global', run.state.globals);
        variableTracker.track('Global');

        let sigint = 0;
        process.on('SIGINT', function () {
            try {
                sigint += 1;

                if (sigint > 1) {
                    process.exit();
                    return;
                }
                
                if (!run.paused) {
                    sigint = 0;
                    breaker.break();
                }
            }
            catch (e) {
                consola.error(e);
                process.exit(1);
            }
        });

        if (reporterOptions.breakOnStart) {
            breaker.break('execution start');
        }
    });

    newman.on('request', function (err, args) {
        latestNetwork = {
            err: err,
            req: args.request,
            res: args.response
        };
    });

    newman.on('done', function (err) {
        delete latestNetwork;

        if (!run) { return; }

        if (err) {
            consola.error(err);
        }

        consola.info(`Newman execution completed.`);
    });
};