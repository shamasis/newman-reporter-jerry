/**
 * @moduleOverview
 *
 * This module tracks changes and snapshot on variable changes. This works by accepting a variable scope and then setup
 * tracking abilities in them. It then can be asked to check in the same scope at a time in future and tell us what
 * changed in them.
 *
 */
const colors = require('colors');
const Table = require('cli-table3');

const trackerSymbol = Symbol('Jerry: Tracker');
const trackerKey = Symbol('Jerry: Tracker Shadow Key');
const trackerVal = Symbol('Jerry: Tracker Shadow Value');

class VarTracker {
  constructor () {
    this.attachments = new Map();
  }

  attach (name, scope, andTrack) {
    this.attachments.set(name, scope);
    scope[trackerSymbol] = new Map(); // hidden store
    scope[trackerSymbol].scopeName = name;
    andTrack && this.track(name);
  }

  detach (name) {
    const scope = this.attachments.get(name);

    if (scope) {
      VarTracker.uninspect(scope);
      this.attachments.delete(name);
    }
  }

  track (name) {
    const scope = this.attachments.get(name);

    if (!scope) {
      return;
    }

    const report = VarTracker.inspect(scope);

    if (report.added || report.deleted || report.updated) {
      report.modified = true;
    }

    return report;
  }

  static list (varscope) {
    const tracker = varscope[trackerSymbol];
    const scopeName = tracker.scopeName;

    return varscope.values.members.map((variable) => {
      return [variable.key, variable.value, scopeName];
    });
  }

  static inspect (varscope) {
    const tracker = varscope[trackerSymbol];
    const scopeName = tracker.scopeName;
    const diff = [];

    varscope.values.members.forEach((variable) => {
      let shadow = tracker.get(variable);

      // if shadow item exists then we track the change
      if (shadow) {
        let keyChange,
          valChange;

        if (shadow[trackerKey] !== variable.key) {
          keyChange = `${colors.gray.strikethrough(shadow[trackerKey])} ${variable.key}`;
        }

        if (shadow[trackerVal] !== variable.value) {
          valChange = `${variable.value} ${colors.gray.strikethrough(shadow[trackerVal])}`;
        }

        shadow[trackerKey] = variable.key;
        shadow[trackerVal] = variable.value;

        if (keyChange || valChange) {
          diff.updated = true;
          diff.push(['updated', keyChange || variable.key, valChange || variable.value, scopeName]);
        }

      // if shadow item does not exist, implies this is a newly added item since last inspection and we need to
      // create a new shadow and mark as added and store shadow data
      } else {
        shadow = tracker.set(variable, variable);
        variable[trackerKey] = variable.key;
        variable[trackerVal] = variable.value;

        diff.added = true;
        diff.push(['added', variable.key, variable.value, scopeName]); // paired for printStatusLists
      }
    });

    tracker.forEach((shadow) => {
      if (!varscope.values.members.find(variable => variable === shadow)) {
        diff.deleted = true;
        diff.push(['deleted', shadow.key, shadow.value, scopeName]);
        tracker.delete(shadow);
      }
    });

    return diff;
  }

  static uninspect (varscope) {
    delete varscope[trackerSymbol];
  }

  static printLists (...lists) {
    const table = new Table({ head: ['Name', 'Value', 'Scope'] });
    lists.forEach(row => table.push(...row));
    process.stdout.write(table.toString() + '\n');
  }

  static printStatusLists (...lists) {
    const table = new Table({ head: ['Status', 'Name', 'Value', 'Scope'] });
    lists.forEach(row => table.push(...row));
    process.stdout.write(table.toString() + '\n');
  }
}

module.exports = VarTracker;
