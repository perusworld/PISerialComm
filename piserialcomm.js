"use strict";

var util = require('util');
var serialport = require("serialport");
var readline = require('readline');

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

SerialLogger.prototype.log = function (msg) {
	this.logBuffer.push({ ts: new Date(), msg: msg });
	console.log(msg);
};

function SerialAdpter() {
	this.conf = {
		adapter: {
			synced: false,
			count: 0,
			enabled: false,
			started: false,
			debugMode: false,
		},
		syncSleep: 1000,
		baudrate: 115200
	};
	this.cmdBuffer = new CircularArray(10);

	this.serial = null;
	this.cmdProcessor = null;
};

SerialAdpter.prototype.log = function (msg) {
	if (null != SerialContext.logger) {
		SerialContext.logger.log(msg);
	}
};

SerialAdpter.prototype.init = function (device, processor) {
	if (null == this.serial) {
		this.cmdProcessor = processor;
		this.serial = new serialport.SerialPort(device, {
			baudrate: this.conf.baudrate, parser: serialport.parsers.raw
		});
		this.serial.on("open", this.onOpen.bind(this));
	}
};

SerialAdpter.prototype.onOpen = function () {
	this.conf.adapter.synced = false;
	this.conf.adapter.count = 0;
	this.serial.on('data', this.onData.bind(this));
	setTimeout(this.doSync.bind(this), this.conf.syncSleep);
};

SerialAdpter.prototype.onData = function (data) {
	this.log("Data " + data.toString('hex'));
};

SerialAdpter.prototype.sendToDevice = function (data) {
	this.log("Send Data " + data.toString('hex'));
	this.serial.write(data);
};

SerialAdpter.prototype.doSync = function () {
	if (this.conf.adapter.synced) {
		this.log('In Sync');
		//Done Syncing Stop
	} else {
		this.log('Syncing');
		setTimeout(this.doSync.bind(this), this.conf.syncSleep);
	}
};

SerialAdpter.prototype.processCommand = function (data) {
	if (null != this.cmdProcessor) {
		this.cmdProcessor.handleCommand(data);
	}
};

function ByteSerialAdpter() {
	ByteSerialAdpter.super_.call(this);
	this.conf.COMMAND = {
		PING_IN: 0xCC, PING_OUT: 0xDD, DATA: 0xEE, EOM_FIRST: 0xFE, EOM_SECOND: 0xFF
	};
	this.conf.DATA = new Buffer([this.conf.COMMAND.DATA]);
	this.conf.EOM = new Buffer([this.conf.COMMAND.EOM_FIRST, this.conf.COMMAND.EOM_SECOND]);
	this.conf.PING_IN = Buffer.concat([new Buffer([this.conf.COMMAND.PING_IN]), this.conf.EOM]);
	this.incomingBuffer = {
		data: [],
		last: 0
	};
}

util.inherits(ByteSerialAdpter, SerialAdpter);

ByteSerialAdpter.prototype.sendRaw = function (data) {
	this.log("Byte Send Raw " + data.toString('hex'));
	this.serial.write(data);
};

ByteSerialAdpter.prototype.sendToDevice = function (data) {
	this.log("Byte Send Data " + data.toString('hex'));
	this.serial.write(Buffer.concat([this.conf.DATA, data, this.conf.EOM]));
};

ByteSerialAdpter.prototype.onData = function (data) {
	this.log("Byte Data " + data.toString('hex'));
	var len = data.length;
	var curr = 0;
	var cmd;
	for (var index = 0; index < len; index++) {
		curr = data[index];
		if (this.incomingBuffer.last == this.conf.COMMAND.EOM_FIRST
			&& curr == this.conf.COMMAND.EOM_SECOND) {
			this.cmdBuffer.push({
				cmd: this.incomingBuffer.data[0],
				data: new Buffer(this.incomingBuffer.data.slice(1, this.incomingBuffer.data.length - 1))
			});
			this.incomingBuffer.last = 0;
			this.incomingBuffer.data = [];
		} else {
			this.incomingBuffer.data.push(curr);
			this.incomingBuffer.last = curr;
		}
	}
	while (0 < this.cmdBuffer.length()) {
		cmd = this.cmdBuffer.buffer.shift();
		if (this.conf.COMMAND.PING_OUT == cmd.cmd) {
			this.conf.adapter.synced = true;
		} else if (this.conf.COMMAND.DATA == cmd.cmd) {
			if (this.conf.adapter.synced) {
				this.processCommand(cmd.data);
			} else {
				this.log("Got data without sync " + cmd.data.toString('hex'));
			}
		} else {
			this.log("Unknown cmd " + cmd.cmd.toString(16));
		}
	}
};

ByteSerialAdpter.prototype.doSync = function () {
	if (this.conf.adapter.synced) {
		this.log('In Sync');
		//Done Syncing Stop
	} else {
		this.log('Syncing');
		if (0 == this.conf.adapter.count) {
			//first pass nothing
		} else {
			//shift by one incase of stray buffer data
			this.conf.adapter.count = this.conf.adapter.count + 1;
			this.serial.write([this.conf.COMMAND.DATA]);
		}
		this.sendRaw(this.conf.PING_IN);
		setTimeout(this.doSync.bind(this), this.conf.syncSleep);
	}
};

function SerialCommandProcessor() {
	this.adapter = null;
};

SerialCommandProcessor.prototype.log = function (msg) {
	if (null != SerialContext.logger) {
		SerialContext.logger.log(msg);
	}
};

SerialCommandProcessor.prototype.init = function (adpter) {
	this.adapter = adpter;
};

SerialCommandProcessor.prototype.handleCommand = function (buf) {
};

SerialCommandProcessor.prototype.debugCommand = function (buf) {
	switch (buf[0]) {
		default:
			this.log("Unknown command " + buf.toString());
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
	switch (line.trim()) {
		default:
			this.log('Unknown command ' + line.trim());
			break;
	}
	this.rl.prompt();
};

LogSerialCommandProcessor.prototype.handleCommand = function (buf) {
	this.debugCommand(buf);
};


module.exports.SerialContext = SerialContext;
module.exports.SerialLogger = SerialLogger;
module.exports.ByteSerialAdpter = ByteSerialAdpter;
module.exports.SerialCommandProcessor = SerialCommandProcessor;
module.exports.LogSerialCommandProcessor = LogSerialCommandProcessor;
