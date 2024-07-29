const { logger } = require("./log");
const { help: activateHelp } = require("./activate");
const { help: cleanHelp } = require("./clean");
const { help: configHelp } = require("./config");
const { help: importHelp } = require("./import");
const { help: makeHelp } = require("./make");
const { help: startHelp } = require("./start");

function command(configProg) {
	let msg = configProg.commandName + " -h help : Show this.\n";
	msg += activateHelp(configProg.commandName, false);
    msg += cleanHelp(configProg.commandName, false);
	msg += configHelp(configProg.commandName, false);
	msg += configProg.commandName + " destroy : destroy the container\n";
	msg += importHelp(configProg.commandName, false);
	msg += makeHelp(configProg.commandName, false);
	msg += startHelp(configProg.commandName, false);
	logger(msg);
};

module.exports = { command };
