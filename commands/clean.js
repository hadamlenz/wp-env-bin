"use-strict";
const { logger } = require("../commands/log.js");
const { run } = require("../commands/run.js");
const { confirm } = require("@inquirer/prompts");

/** the help command */
function help(commandName, log = false) {
	return logger(commandName + " clean : clean up created files", log);
}

/** the cli command */
function command(subcommand, conf) {
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(conf.commandName, true);
			break;
		default:
			//clean up created files
			maybeCleanupFiles(conf.commandName);
	}
}

/**
 * use inquirer to see if we should clean up the files
 * clean em up
 */
async function maybeCleanupFiles(commandName) {
	const cleanFiles = await confirm({
		message: "Are you sure you want to destroy the assets?",
		type: "confirm",
		name: "cleanFiles",
	});
	if( cleanFiles === true ){
		logger("> cleaning up " + commandName + " assets\n");
		run("rm -f ./assets/wp-env/database.sql ./assets/wp-env/.htaccess ./assets/wp-env/config.json");
	} else {
		logger("> few, we saved the files\n");
	}
}

module.exports = { command, help };
