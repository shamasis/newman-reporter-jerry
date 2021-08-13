/**
 * @moduleOverview
 * 
 * This module tracks changes and snapshot on variable changes. This works by accepting a variable scope and then setup
 * tracking abilities in them. It then can be asked to check in the same scope at a time in future and tell us what
 * changed in them.
 * 
 */
const EventEmitter = require('events'),
	colors = require('colors'),

	trackerSymbol = Symbol('Tracker'),
	_key = Symbol('Tracker Shadow Key'),
	_val = Symbol('Tracker Shadow Value');


class VarTracker extends EventEmitter {

	constructor () {
		super();

		this.attachments = new Map();
	}

	attach (name, scope) {
		this.attachments.set(name, scope);
	}

	detach (name) {
		let scope = this.attachments.get(name);

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

		let report = VarTracker.inspect(scope, name);

		if (report.added || report.deleted || report.updated) {
			report.modified = true;
			// this.emit('modified', name, report);
		}

		return report;
	}

	static list (varscope, scopeName) {
		return varscope.values.members.map((variable) => {
			return [variable.key, variable.value, scopeName];
		});
	}

	static inspect (varscope, scopeName) {
		let tracker = varscope[trackerSymbol] || (varscope[trackerSymbol] = new Map()),
			diff = [];

		varscope.values.members.forEach((variable) => {
			let shadow = tracker.get(variable);


			// if shadow item exists then we track the change
			if (shadow) {
				let keyChange, 
					valChange;

				if (shadow[_key] != variable.key) {
					keyChange = `${colors.gray.strikethrough(shadow[_key])} ${variable.key}`;
				}

				if (shadow[_val] != variable.value) {
					valChange = `${colors.gray.strikethrough(shadow[_val])} ${variable.value}`;
				}

				shadow[_key] = variable.key;
				shadow[_val] = variable.value;

				if (keyChange || valChange) {
					diff.updated = true;
					diff.push(['updated', keyChange || variable.key, valChange || variable.value, scopeName]);
				}
				
			}
			// if shadow item does not exist, implies this is a newly added item since last inspection and we need to 
			// create a new shadow and mark as added and store shadow data
			else {
				shadow = tracker.set(variable, variable);
				variable[_key] = variable.key;
				variable[_val] = variable.value;

				diff.added = true;
				diff.push(['added', variable.key, variable.value, scopeName]);
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

}

module.exports = VarTracker;
