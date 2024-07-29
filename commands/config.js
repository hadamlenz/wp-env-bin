"use strict";
const inquirer = require("inquirer");
const { run } = require("./run.js");
const { logger } = require("./log.js");
const { makeHtaccess, makeConfig } = require("./make.js");
const { getConfig } = require("./get.js");
const { checkConfig } = require("./check.js");
const { startLocalBasic, startlocalRemote } = require("./start.js");

/** the cli command */
function command(subcommand, config) {
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(config.commandName,true);
			break;
		default: {
			//run config
			config();
			break;
		}
	}
}

function help(commandName, log = false) { 
	return logger(commandName + " config : start the configurator",log);
}

/**
 * run config maker in inquirer
 */
function config(){
	console.log('future home of the config maker')
}

/**
 * maybe use config items as default answers for questions
 * @param {*} answers 
 * @param {*} param 
 * @returns 
 */
function maybeUseConfig(answers, param) {
	if (answers.useConfig == "useIt") {
		var config = getConfig();
		return config[param];
	}
}

/**
 * if the answer is type simple
 * @param {*} answers 
 * @returns 
 */
function is_simple_answer(answers) {
	if (answers.type == "simple") {
		return true;
	} else {
		return false;
	}
}

module.exports = { command, help, maybeUseConfig };
