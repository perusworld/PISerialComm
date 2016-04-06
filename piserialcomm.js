"use strict";

module.exports = {
	context: function () {
		return require('./context');
	},
	adapters: function () {
		return require('./adapter');
	},
	processors: function () {
		return require('./processor');
	},
	mockAdapters: function () {
		return require('./mock-adapter');
	}
}



