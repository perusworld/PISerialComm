"use strict";

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var readline = require('readline');
var ctx = require('./context');
var adapter = require('./adapter');

function MockSerial() {
    MockSerial.super_.call(this);
}

util.inherits(MockSerial, EventEmitter);

MockSerial.prototype.log = function() {
    if (null !== ctx.SerialContext.logger) {
        ctx.SerialContext.logger.log(arguments);
    }
};

MockSerial.prototype.doOpen = function() {
    this.log('Sending serial on open');
    this.emit('open');
};

MockSerial.prototype.doData = function(data) {
    this.log('Sending serial on data', data.toString('hex'));
    this.emit('data', data);
};

MockSerial.prototype.write = function(data) {
    if (!Buffer.isBuffer(data)) {
        data = new Buffer(data);
    }
    this.log('Got serial write', data.toString('hex'));
};

function MockByteSerialAdpter(config) {
    MockByteSerialAdpter.super_.call(this, config);
};

util.inherits(MockByteSerialAdpter, adapter.ByteSerialAdpter);

MockByteSerialAdpter.prototype.buildSerial = function(device) {
    this.log('Returning mock serial');
    return new MockSerial();
};

module.exports.MockByteSerialAdpter = MockByteSerialAdpter;
