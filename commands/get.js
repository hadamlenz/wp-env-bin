/**
 * get data from somewhere
 * much of this is very specific to pantheon
 */

const { terminus_wp } = require("./run.js");
const { checkConfig } = require("./check.js");
const { readFileSync } = require("fs");
const { logger } = require("./log.js");

/** the help command */
function help(commandName, log = false) {
	let msg = commandName + " get : get data from elsewhere\n";
	msg = "- " + commandName + " get remote-db : gets the db based on config.json\n";
	msg = "- " + commandName + " get remote-network-plugins : get the list of plugins that are activated on the remote\n";
	return logger(msg, log);
}

/** the get command */
function command(subcommand, configProg) {
	//get data from elsewhere
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help();
			break;
		case "remote-db": {
			//get the remote db based on settings in ./assets/config
			getRemoteDb(configProg.commandName);
			break;
		}
		case "remote-network-plugins": {
			logger(getNetowrkPlugins());
			break;
		}
		default: {
			logger("> please clarify what you'd like to get, run " + program_name + " get help for more\n");
			break;
		}
	}
}

/**
 * gets remote tables
 * @returns the tables from the remote
 */
function getRemoteTables() {
	const config = getConfig();
	if (config.env && config.url) {
		let tables = terminus_wp(config.env, "db tables --format=csv --url=" + config.url + " --format=csv --all-tables-with-prefix", { stdio: "pipe", encoding: "utf8" });
		//console.log( 'tables: ' + tables );
		return tables.trim();
	} else {
		logger("you need to have a pantheon env and url in the config file\n");
	}
}

/**
 * gets the remote database using the remotes table function above
 */
function getRemoteDb() {
	//get the tables
	const tables = getRemoteTables();

	//if tables could not be got
	if (!tables) {
		logger("> could not get the table list\n");
		return false;
	}

	const config = getConfig();
	if (config && config.url && config.url !== "" && config.siteId && config.siteId !== "") {
		//console.log( tables + 'fuu' );
		let cmd = "db export - --url=" + config.url + " --tables=" + tables + " > ./assets/wp-env/database.sql";
		//console.log(cmd);
		return terminus_wp(config.env, cmd, { stdio: "ignore" });
	} else {
		logger("> you need to have a pantheon env and url in the config file\n");
		return false;
	}
}

/**
 * get the config props that define the container
 * @returns an array if config is there, else false
 */
function getConfig() {
	if (checkConfig()) {
		let file = readFileSync("./assets/wp-env/config.json");
		const config = JSON.parse(file);
		return config;
	} else {
		return false;
	}
}

/**
 * get the wp-env.json 
 * @returns object
 */
function getWpEnvJson(){
	return readFileSync("./.wp-env.json");
}

module.exports = {
	command,
	help,
	getConfig,
	getRemoteDb,
	getRemoteTables,
	getWpEnvJson
};
