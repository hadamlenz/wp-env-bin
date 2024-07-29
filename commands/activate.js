/** turn things on and off inside of wordpress */
"use strict";
const { wpcli } = require("./run.js");
const { logger } = require("./log");

/** the help command */
function help (commandName, log = false) {
	let msg = commandName + " activate : activate various things in the container using the following subcommands\n";
	msg += "- " + commandName + " activate default-theme : activate the wilson theme\n";
	msg += "- " + commandName + " activate default-plugins : activate the basic plugins that wilson uses\n";
	return logger(msg, log);
};

/** the cli command */
function command(subcommand, configProg) {
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(configProg.commandName, true);
			break;
		case "theme": {
			//coming soon
			break;
		}
		case "plugins": {
			//coming soon
			break;
		}
		case "default-theme": {
			//activate wilson
			activateTheme(configProg.themeName);
			break;
		}
		case "default-plugins": {
			//activate the normal wilson plugins
			activatePlugins(configProg.defaultPlugins);
			break;
		}
		default: {
			logger("> what would you like to activate? run " + configProg.commandName + " activate help for more\n");
			break;
		}
	}
};

module.exports = { command, help };

/**
 *
 * @param {string} themeName
 */
function activateTheme(themeName) {
	wpcli("wp theme activate " + themeName);
}

/**
 *
 * @param {array} plugins
 */
function activatePlugins(plugins) {
	let pluginsString = plugins.join(" ");
	wpcli("wp plugins activate " + pluginsString);
}
