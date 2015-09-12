"use strict";

var util = require('util');
var serialport = require("serialport");
var CircularBuffer = require('cbarrick-circular-buffer');
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
		packetSize: 3,
		syncSleep: 1000,
		baudrate: 115200
	};

	this.incomingBuffer = new CircularBuffer({
		size: 1024,
		encoding: "buffer"
	});

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

function ByteSerialAdpter() {
	ByteSerialAdpter.super_.call(this);
	this.conf.COMMAND = {
		PING_IN: 0xCC, PING_OUT: 0xDD, EOM: new Buffer([0xFE, 0xFF])
	};
}

util.inherits(ByteSerialAdpter, SerialAdpter);

ByteSerialAdpter.prototype.sendToDevice = function (data) {
	this.log("Byte Send Data " + data.toString('hex'));
	this.serial.write(Buffer.concat([data, this.conf.COMMAND.EOM]));
};

ByteSerialAdpter.prototype.onData = function (data) {
	this.log("Data " + data.toString('hex'));
	if (this.conf.adapter.synced && this.conf.packetSize == data.length
		&& (this.conf.COMMAND.DATA == data[0] || this.conf.COMMAND.NONE == data[0])) {
		this.log('Out Of Sync ReSyncing');
		this.conf.adapter.synced = false;
		this.conf.adapter.enabled = false;
		setTimeout(this.doSync.bind(this), this.conf.syncSleep);
	} else if (!this.conf.adapter.synced && this.conf.packetSize == data.length
		&& this.conf.COMMAND.PING_OUT == data[0] && this.conf.COMMAND.DATA == data[2]) {
		this.conf.adapter.synced = true;
		this.conf.adapter.enabled = (0x01 & data[1]) == 0x01;
		this.conf.adapter.debugMode = (0x02 & data[1]) == 0x02;
	}
	if (this.conf.adapter.synced) {
		this.incomingBuffer.write(data);
		while (this.conf.packetSize <= this.incomingBuffer.length) {
			this.processCommand(this.incomingBuffer.read(this.conf.packetSize));
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
		this.sendToDevice(new Buffer([this.conf.COMMAND.PING_IN]));
		setTimeout(this.doSync.bind(this), this.conf.syncSleep);
	}
};

function JsonSerialAdpter() {
	JsonSerialAdpter.super_.call(this);
	this.conf.COMMAND = {
		NONE: "none", PING_IN: "pingIn", PING_OUT: "pingOut", TIMEOUT: "timeout", DATA: "data"
	};
}

util.inherits(JsonSerialAdpter, SerialAdpter);

JsonSerialAdpter.prototype.onData = function (data) {
	this.log("Data " + data.toString('hex'));
	if (this.conf.adapter.synced && this.conf.packetSize == data.length
		&& (this.conf.COMMAND.DATA == data[0] || this.conf.COMMAND.NONE == data[0])) {
		this.log('Out Of Sync ReSyncing');
		this.conf.adapter.synced = false;
		this.conf.adapter.enabled = false;
		setTimeout(this.doSync.bind(this), this.conf.syncSleep);
	} else if (!this.conf.adapter.synced && this.conf.packetSize == data.length
		&& this.conf.COMMAND.PING_OUT == data[0] && this.conf.COMMAND.DATA == data[2]) {
		this.conf.adapter.synced = true;
		this.conf.adapter.enabled = (0x01 & data[1]) == 0x01;
		this.conf.adapter.debugMode = (0x02 & data[1]) == 0x02;
	}
	if (this.conf.adapter.synced) {
		this.incomingBuffer.write(data);
		while (this.conf.packetSize <= this.incomingBuffer.length) {
			this.processCommand(this.incomingBuffer.read(this.conf.packetSize));
		}
	}
};

JsonSerialAdpter.prototype.doSync = function () {
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
		this.sendToDevice(new Buffer([this.conf.COMMAND.PING_IN, this.conf.COMMAND.DATA, this.conf.COMMAND.DATA]));
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
			process.exit(0);
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
module.exports.JsonSerialAdpter = JsonSerialAdpter;
module.exports.SerialCommandProcessor = SerialCommandProcessor;
module.exports.LogSerialCommandProcessor = LogSerialCommandProcessor;
