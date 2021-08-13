const prompts = require('prompts'),
	EventEmitter = require('events');

class CLIBreakManager {
	constructor () {
		this.operations = [];
		this.lastOperationIndex = 0;
	}

	break () {
		throw new Error('CLIBreakManager not setup');
	}

	continue () {
		throw new Error('CLIBreakManager not setup');
	}

	setup (options) {
		let onBreak = options.onBreak,
			onContinue = options.onContinue;

		this.break = function (message) {
			onBreak(() => {
				this.present(message);
			});
		};

		this.continue = function () {
			onContinue(() => {});
		};
	}

	add (title,  action) {;
		this.operations.push({
			title: title,
			value: {
				action: action,
				index: this.operations.length
			}
		});
	}

	addBreakOperation (title, action) {;
		this.operations.push({
			title: title,
			value: {
				action: action,
				index: this.operations.length
			}
		});
	}

	present (message) {
		this.constructor.prompt(message, this.operations, this.lastOperationIndex, (choice) => {
			this.lastOperationIndex = choice.index;

			choice.action((err, forward) => {
				if (forward) {
					this.continue();
					return;
				}
				else {
					this.present();
				}
			});
		});
	}

	static prompt (message, choices = [], initial = 0, callback) {
		console.log(''); // add newline spacer
		prompts({
			type: 'select',
            name: 'value',
            message: 'Run paused' + (message ? ` on ${message}` : ''),
            choices: choices,
            initial: initial,
		}, { onSubmit: (p, a) => callback(a) });
	}
}

module.exports = CLIBreakManager;