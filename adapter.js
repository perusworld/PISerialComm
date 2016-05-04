"use strict";

var util = require('util');
var merge = require("merge");
var serialport = require("serialport");
var ctx = require('./context');
var appConfig = require('./config');
var protocol = require('./protocol');

function SerialAdpter(config) {
    if (!config) {
        config = {};
    }
    this.conf = merge(appConfig.serial.default, config);
    this.conf.adapter = merge({}, appConfig.serial.adapter);
    this.cmdBuffer = new ctx.CircularArray(10);

    this.serial = null;
    this.cmdProcessor = null;
};

SerialAdpter.prototype.log = function() {
    if (null != ctx.SerialContext.logger) {
        ctx.SerialContext.logger.log(arguments);
    }
};

SerialAdpter.prototype.buildSerial = function(device) {
    return new serialport.SerialPort(device, {
        baudrate: this.conf.baudrate, parser: serialport.parsers.raw
    });
};

SerialAdpter.prototype.init = function(device, processor) {
    if (null == this.serial) {
        this.cmdProcessor = processor;
        this.serial = this.buildSerial(device);
        this.serial.on("open", this.onOpen.bind(this));
    }
};

SerialAdpter.prototype.onOpen = function() {
    this.conf.adapter.synced = false;
    this.conf.adapter.count = 0;
    this.serial.on('data', this.onData.bind(this));
    this.startSync();
};

SerialAdpter.prototype.startSync = function() {
};

SerialAdpter.prototype.onData = function(data) {
    this.log("Data " + data.toString());
    if (this.conf.adapter.synced) {
        this.processCommand(cmd.data);
    }
};

SerialAdpter.prototype.sendToDevice = function(data) {
    this.log("Send Data " + data.toString('hex'));
    this.serial.write(data);
};

SerialAdpter.prototype.doSync = function() {
    if (this.conf.adapter.synced) {
        this.log('In Sync');
        //Done Syncing Stop
    } else {
        this.log('Syncing');
        setTimeout(this.doSync.bind(this), this.conf.syncSleep);
    }
};

SerialAdpter.prototype.processCommand = function(data) {
    if (null != this.cmdProcessor) {
        this.cmdProcessor.handleCommand(data);
    }
};

function ByteSerialAdpter(config) {
    ByteSerialAdpter.super_.call(this, merge({}, appConfig.byte.protocol, config));
    protocol.mergeCommands(this.conf.protocol);
    this.incomingBuffer = {
        data: [],
        last: 0
    };
}

util.inherits(ByteSerialAdpter, SerialAdpter);

ByteSerialAdpter.prototype.sendRaw = function(data) {
    this.log("Byte Send Raw " + data.toString('hex'));
    this.serial.write(data);
};

ByteSerialAdpter.prototype.sendToDevice = function(data) {
    this.log("Byte Send Data " + data.toString('hex'));
    this.serial.write(Buffer.concat([this.conf.protocol.DATA, data, this.conf.protocol.EOM]));
};

ByteSerialAdpter.prototype.onData = function(data) {
    this.log("Byte Data " + data.toString('hex'));
    var len = data.length;
    var curr = 0;
    var cmd;
    for (var index = 0; index < len; index++) {
        curr = data[index];
        if (this.incomingBuffer.last == this.conf.protocol.COMMAND.EOM_FIRST
            && curr == this.conf.protocol.COMMAND.EOM_SECOND) {
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
        if (this.conf.protocol.COMMAND.PING_OUT == cmd.cmd) {
            this.log("Got sync");
            this.conf.adapter.synced = true;
        } else if (this.conf.protocol.COMMAND.PING_IN == cmd.cmd) {
            this.conf.adapter.synced = false;
            this.sendRaw(this.conf.protocol.PING_OUT);
            this.sendRaw(this.conf.protocol.PING_IN);
        } else if (this.conf.protocol.COMMAND.DATA == cmd.cmd) {
            if (this.conf.adapter.synced) {
                this.processCommand(cmd.data);
            } else {
                this.log("Got data without sync " + cmd.data.toString('hex'));
                this.sendRaw(this.conf.protocol.PING_IN);
            }
        } else {
            this.log("Unknown cmd " + cmd.cmd.toString(16));
        }
    }
};

ByteSerialAdpter.prototype.startSync = function() {
    setTimeout(this.doSync.bind(this), this.conf.syncSleep);
};

ByteSerialAdpter.prototype.doSync = function() {
    if (this.conf.adapter.synced) {
        this.log('In Sync');
        //Done Syncing Stop
    } else {
        this.log('Syncing');
        if (0 == this.conf.adapter.count) {
            this.log('Starting Sync');
            this.conf.adapter.count = this.conf.adapter.count + 1;
            //first pass nothing
        } else {
            //shift by one incase of stray buffer data
            this.conf.adapter.count = this.conf.adapter.count + 1;
            this.sendRaw(this.conf.protocol.EOM);
        }
        this.sendRaw(this.conf.protocol.PING_IN);
        setTimeout(this.doSync.bind(this), this.conf.syncSleep);
    }
};

module.exports.SerialAdpter = SerialAdpter;
module.exports.ByteSerialAdpter = ByteSerialAdpter;
