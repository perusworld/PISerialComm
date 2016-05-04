var piserialcomm = require('./piserialcomm');
var adapters = piserialcomm.adapters();
var processors = piserialcomm.processors();
var ctx = piserialcomm.context();

var serialAdapter = new adapters.SerialAdpter();
var serialLogger = new ctx.SerialLogger();
var cmdProcessor = new processors.LogSerialCommandProcessor();

serialLogger.init(300);
ctx.SerialContext.init(serialLogger, serialAdapter);

serialAdapter.init('/dev/ttyAMA0', cmdProcessor);
cmdProcessor.init(serialAdapter);

