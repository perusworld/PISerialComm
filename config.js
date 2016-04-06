"use strict";

var protocol = require('./protocol');

module.exports = {

    serial: {
        default: {
            syncSleep: 1000,
            baudrate: 115200
        },
        adapter: {
            synced: false,
            count: 0,
            enabled: false,
            started: false,
            debugMode: false,
        }
    },
    byte: {
        protocol: {
            protocol: {
                COMMAND: protocol.command,
                pingTimer: 1000
            }
        }
    }

};
