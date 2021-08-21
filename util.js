/**
 * @fileOverview
 * Utilties with no side-effects used all across the project
 */
const prettyms = require('pretty-ms');

module.exports = {
  print (...args) {
    process.stdout.write(...args);
  },

  printlf (...args) {
    args.length && process.stdout.write(...args);
    process.stdout.write('\n');
  },

  prettyms (ms) {
    if (ms < 1) {
      return `${parseInt(ms * 1000, 10)}µs`;
    }

    return (ms < 1998) ? `${parseInt(ms, 10)}ms` : prettyms(ms || 0);
  }
};
