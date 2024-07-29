const { run } = require("./run.js");
const { checkConfig, checkDatabase, checkHtaccess } = require("./check.js");
const { makeHtaccess, makeBlankConfig, makeBasicConfig, makeRemoteConfig } = require("./make.js");
const { getConfig, getRemoteDb } = require("./get.js");
const { importRemoteDb, prefixRename, dropTables } = require("./import.js");
const { logger } = require("./log.js");
const { confirm, select } = require("@inquirer/prompts");

function command(subcommand, config) {
	//start up a new instance
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(config.commandName, true);
			break;
		case "basic":
			startLocalBasic(config);
			break;
		case "remote":
			startlocalRemote(config);
			break;
		default:
			//do the same as basic
			startLocalBasic(config);
			break;
	}
}

/** the help command */
function help(commandName, log = false) {
	let msg = commandName + " start";
	msg += "- " + commandName + " start basic : start a basic ";
	msg += "- " + commandName + " start remote";
	return logger(msg, log);
}

/**
 * startup a local basic instance
 * has wilson enabled on startup
 * has Unc Content elements, unc custom css, and unc utility bar enabled on startup
 * has an htaccess created on startup
 */
async function startLocalBasic() {
	if (checkConfig()) {
		const useConfigA = await select({
			message: "There is already a config file. What would you like to do with it?",
			choices: [
				{
					name: "Use the old one",
					value: "useIt",
					description: "Use the old config",
				},
				{
					name: "Destroy the old config and start over",
					value: "destroyIt",
					description: "Destroy the old config and start over",
				},
			],
		});

		if (useConfigA == "useIt") {
			logger("> Okee Dokie! old config saved from the bottomless pit of rm\n");
		} else if (useConfigA == "destroyIt") {
			logger("> All those moments will be lost in time, like tears in rain. Time to die (config was destroyed)\n");
			run("rm -f ./assets/wp-env/config.json");
			//makeANewConfigForBasic();
			makeBasicConfig(conf);
		}
	} else {
		//makeANewConfigForBasic();
		makeBasicConfig(conf);
	}

	if (checkHtaccess()) {
		const useHtaccessA = await select({
			message: "There is already an .htaccess file. What would you like to do with it?",
			choices: [
				{
					name: "Use the old .htaccess",
					value: "useIt",
				},
				{
					name: "Destroy the old .htaccess and start over",
					value: "destroyIt",
				},
			],
		});

		if (useHtaccessA == "useIt") {
			logger("> Okee Dokie! old .htaccess saved from the bottomless pit of rm\n");
		} else if (useHtaccessA == "destroyIt") {
			logger("> All those moments will be lost in time, like tears in rain. Time to die (config was destroyed)\n");
			run("rm -f ./assets/wp-env/.htaccess");
			makeHtaccess("basic");
		}
	} else {
		makeHtaccess("basic");
	}
	maybeStartWpEnv();
}

async function startlocalRemote() {
	//make a config file
	if (checkConfig()) {
		const useConfigA = await select({
			message: "There is already a config file. What would you like to do with it?",
			choices: [
				{
					name: "Use the old one",
					value: "useIt",
					description: "Use the old config",
				},
				{
					name: "Destroy the old config and start over",
					value: "destroyIt",
					description: "Destroy the old config and start over",
				},
				{
					name: "Make a new Config using the old one as defaults",
					value: "editIt",
					description: "Destroy the old config and start over",
				},
			],
		});

		if (useConfigA == "useIt") {
			logger("> Okee Dokie! old config saved from the bottomless pit of rm\n");
		} else if (useConfigA == "destroyIt") {
			logger("> All those moments will be lost in time, like tears in rain. Time to die (config was destroyed)\n");
			run("rm -f ./assets/wp-env/config.json");
			makeRemoteConfig();
		} else if (useConfigA == "editIt") {
			makeRemoteConfig(true);
		}
	} else {
		makeRemoteConfig();
	}

	//make htaccess
	if (checkHtaccess()) {
		const useHtaccessA = await select({
			message: "There is already an .htaccess file. What would you like to do with it?",
			choices: [
				{
					name: "Use the old .htaccess",
					value: "useIt",
				},
				{
					name: "Destroy the old .htaccess and start over",
					value: "destroyIt",
				},
			],
		});

		if (useHtaccessA == "useIt") {
			logger("> Okee Dokie! old .htaccess saved from the bottomless pit of rm\n");
		} else if (useHtaccessA == "destroyIt") {
			logger("> All those moments will be lost in time, like tears in rain. Time to die (config was destroyed)\n");
			run("rm -f ./assets/wp-env/.htaccess");
			makeHtaccess("remote");
		}
	} else {
		makeHtaccess("remote");
	}

	//start up wp-env
	maybeStartWpEnv();

	//maybe get the database
	if (checkDatabase()) {
		const useDatabaseA = await select({
			message: "There is already a database file. What would you like to do with it?",
			choices: [
				{
					name: "Use the old database",
					value: "useIt",
				},
				{
					name: "Destroy the old database and redownload",
					value: "destroyIt",
				},
			],
		});

		if (useDatabaseA == "useIt") {
			logger("> Okee Dokie! old db saved from the bottomless pit of rm\n");
		} else if (useDatabaseA == "destroyIt") {
			logger("> All those moments will be lost in time, like tears in rain. Time to die (database was destroyed)\n");
			run("rm -f ./assets/wp-env/database.sql");
			logger("> getting remote database\n");
			//get the remote db based on settings in ./assets/config
			getRemoteDb();
		}
	} else {
		logger("> getting remote database\n");
		getRemoteDb();
	}

	if (checkDatabase()) {
		const importDatabaseA = await confirm({
			message: "do you want to import the database and drop the old database tables?",
		});

		if (importDatabaseA === true) {
			//importDBPrefixChanger();
			importRemoteDb();
			// dropTables();
			// prefixRename(config);
		} else {
			logger("> Okee Dokie! If you want to import the database later, run " + conf.commandName + " import db-prefix-changer && " + conf.commandName + " import remote-db");
		}
	}
}

/**
 * start wp-env if we have what we need to start it
 */
function maybeStartWpEnv() {
	if (checkHtaccess() && checkConfig()) {
		//start up wp-env
		run("npm run wp-env start", { stdio: "inherit" });
		return true;
	} else {
		logger("> Something went wrong when making the nessisary files to spin up this container\n");
		return false;
	}
}

module.exports = {
	command,
	help,
	startLocalBasic,
	startlocalRemote,
};
