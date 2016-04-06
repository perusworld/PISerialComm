"use strict";

var util = require('util');

function SerialContext() {

};

SerialContext.init = function (lgr, adptr) {
	this.logger = lgr;
	this.adapter = adptr;
};

function CircularArray(size) {
	this.buffer = [];
	this.maxSize = size;
};

CircularArray.prototype.push = function (data) {
	if (this.maxSize <= this.buffer.length) {
		this.buffer.shift();
	}
	this.buffer.push(data);
};

CircularArray.prototype.clear = function (data) {
	this.buffer = [];
};

CircularArray.prototype.length = function (data) {
	return this.buffer.length;
};

function SerialLogger() {
	this.logBuffer = null;
};

SerialLogger.prototype.init = function (size) {
	this.logBuffer = new CircularArray(size);
};

SerialLogger.prototype.log = function (args) {
    var msg = util.format.apply(null, args);
	this.logBuffer.push({ ts: new Date(), msg: msg });
	console.log(msg);
};

module.exports.SerialContext = SerialContext;
module.exports.SerialLogger = SerialLogger;
module.exports.CircularArray = CircularArray;
