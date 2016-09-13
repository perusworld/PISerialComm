"use strict";

var util = require('util');
var readline = require('readline');
var ctx = require('./context');

function SerialCommandProcessor() {
	this.adapter = null;
}

SerialCommandProcessor.prototype.log = function () {
	if (null !== ctx.SerialContext.logger) {
		ctx.SerialContext.logger.log(arguments);
	}
};

SerialCommandProcessor.prototype.init = function (adpter) {
	this.adapter = adpter;
};

SerialCommandProcessor.prototype.sendToDevice = function (data) {
	if (null !== this.adapter) {
		this.adapter.sendToDevice(data);
	}
};

SerialCommandProcessor.prototype.handleCommand = function (buf) {
};

SerialCommandProcessor.prototype.debugCommand = function (buf) {
	switch (buf[0]) {
		default:
			this.log("Unknown command " + buf.toString('hex'));
			break;
	}
};

function LogSerialCommandProcessor() {
	LogSerialCommandProcessor.super_.call(this);
	this.rl = readline.createInterface(process.stdin, process.stdout);
	this.rl.setPrompt('>');
	this.rl.prompt();
	this.rl.on('line', this.onDataEntry.bind(this))
		.on('close', function () {
			this.log('Closing');
		}.bind(this));
};

util.inherits(LogSerialCommandProcessor, SerialCommandProcessor);

LogSerialCommandProcessor.prototype.onDataEntry = function (line) {
	this.log('Sending ', line.trim());
	this.sendToDevice(line.trim());
	this.rl.prompt();
};

LogSerialCommandProcessor.prototype.handleCommand = function (buf) {
	this.debugCommand(buf);
};

module.exports.SerialCommandProcessor = SerialCommandProcessor;
module.exports.LogSerialCommandProcessor = LogSerialCommandProcessor;
