"use strict";

var commandDef = {
    PING_IN: 0xCC, PING_OUT: 0xDD, DATA: 0xEE, EOM_FIRST: 0xFE, EOM_SECOND: 0xFF
}

var eom = new Buffer([commandDef.EOM_FIRST, commandDef.EOM_SECOND]);

module.exports = {

    command: commandDef,

    mergeCommands: function(obj) {
        obj.DATA = new Buffer([commandDef.DATA]);
        obj.EOM = eom;
        obj.PING_IN = Buffer.concat([new Buffer([commandDef.PING_IN]), eom]);
        obj.PING_OUT = Buffer.concat([new Buffer([commandDef.PING_OUT]), eom]);
    }

};
