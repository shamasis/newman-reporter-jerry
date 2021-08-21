const prompts = require('prompts');

/**
 * @class CLIBreakManager
 *
 * This class abstracts out the act of managing the breaking of a continuous looping
 * workflow by providing ability to insert CLI options for user select on break.
 */
class CLIBreakManager {
  /**
   * @constructor
   *
   * @param {Object=} [options] Accepts CLIBreak Options. This can also be passed using
   * the {@link CLIBreakManager#setup} function.
   */
  constructor (options) {
    /**
     * @private
     * @type {Object[]}
     */
    this.operations = [];

    /**
     * @private
     * @type {Number}
     */
    this.lastOperationIndex = 0;

    /**
     * @private
     * @type {Boolean}
     */
    this.broken = false;

    /**
     * @private
     * @type {Function(callback)}
     */
    this.onBreak = undefined;

    /**
     * @private
     * @type {Function(callback)}
     */
    this.onContinue = undefined;

    if (options) {
      this.setup(options);
    }
  }

  /**
   * Setup the CLIBreakManager to be operational
   *
   * @param {Object} options Accepts `onBreak` and `onContinue` properties. These are functions
   * that are called when the break manager needs to break or continue. Both these function
   * should accept a callback as a parameter that needs to be called to proceed.
   *
   */
  setup (options) {
    if (!options) {
      return;
    }

    if (typeof options.onBreak === 'function') {
      this.onBreak = options.onBreak;
    }

    if (typeof options.onContinue === 'function') {
      this.onContinue = options.onContinue;
    }

    if (options.signal) {
      let sigint = 0;
      process.on('SIGINT', () => {
        try {
          sigint += 1;

          if (sigint > 1) {
            process.exit();
          }

          if (!this.broken) {
            sigint = 0;
            this.break('CTRL+C interrupt');
          }
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
      });

      this.add('Continue (press CTRL+C to break anytime after)', function (done) {
        done(null, true);
      });
    }
  }

  /**
   * Cause the break manager to execute breaking function and show options to proceed.
   *
   * @param {String=} message This is a message that will be shown as the reason for breaking
   */
  break (message = '') {
    this.broken = true;
    if (!this.onBreak) {
      this.present(message);
      return;
    }

    this.onBreak(() => {
      this.present(message);
    });
  }

  /**
   * Cause the break manager to execute 'continue' function and show options to proceed.
   *
   * @param {String=} message This is a message that will be shown as the reason for 'continue'
   */
  continue (message = '') {
    this.broken = false;
    if (!this.onContinue) {
      message && console.log(message);
      return;
    }

    this.onContinue(() => {
      message && console.log(message);
    });
  }

  /**
   * Add a break operation. This operation will be presented on 'break'
   *
   * @param {String} title The name of the operation that will be presented as part of the
   * list of things that can be done upon 'break'
   *
   * @param {Function(callback(err?:Error, continue=false:Boolean))} The action is a function
   * that will be called when user chooses this from list on break. This function will get a
   * callback that needs to be executed after completion of the operation. It can return an error
   * as part of the callback's first parameter and a boolean as second parameter indicating to the
   * break manager whether to continue or to repeat break options after this.
   */
  add (title, action) {
    this.operations.push({
      title: title,
      value: {
        action: action,
        // record the position of the op on list. this will be used to re-position
        // to the same option on consecutive breaks
        index: this.operations.length
      }
    });
  }

  /**
   * Function that presents the break op list
   * @private
   *
   * @param {String} message
   */
  present (message) {
    this.constructor.prompt(message, this.operations, this.lastOperationIndex, (choice) => {
      this.lastOperationIndex = choice.index;

      choice.action((err, forward) => {
        if (err) { console.error(err); }

        forward ? this.continue() : this.present();
      });
    });
  }

  /**
   * A function that makes presenting the CLI options from an array
   * @private
   */
  static prompt (message, choices = [], initial = 0, callback) {
    console.log(''); // add newline spacer
    prompts({
      type: 'select',
      name: 'value',
      message: 'Run paused' + (message ? ` on ${message}` : ''),
      choices: choices,
      initial: initial
    }, { onSubmit: (p, a) => callback(a) });
  }
}

module.exports = CLIBreakManager;
