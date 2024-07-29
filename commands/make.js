const { writeFileSync } = require("fs");
const { getConfig } = require("./get");
const { logger } = require("./log.js");
const inquirer = require("inquirer");
const { input } = require("@inquirer/prompts");

function command(subcommand, conf) {
	//make configs
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(conf.commandName, true);
			break;
		case "basic-htaccess": {
			//make the basic htaccess
			makeHtaccess("basic");
			break;
		}
		case "blank-config": {
			makeBlankConfig();
			break;
		}
		case "basic-config": {
			//should run the sinle site bit of the configurator
			makeBasicConfig(conf);
			break;
		}
		case "remote-config": {
			//run the configurator knowing that its from a multisite
			makeRemoteConfig();
			break;
		}
		case "remote-htaccess": {
			//make the htaccess for the remote copy
			makeHtaccess("remote");
			break;
		}
		default: {
			let msg = "> please clarify what you want to make";
			logger(msg);
			break;
		}
	}
}

/** the help command */
//todo this needs all of the commands
function help(commandName, log = false) {
	let msg = commandName + " make : makes files\n";
	msg += "- " + commandName + " make basic-htaccess\n";
	msg += "- " + commandName + " make basic-config\n";
	msg += "- " + commandName + " make blank-config\n";
	msg += "- " + commandName + " make remote-config\n";
	msg += "- " + commandName + " make remote-htaccess\n";
	return logger(msg, log);
}

function makeBasicConfig(conf) {
	//run the configurator knowing that its a single site
	makeConfig({ env: "", url: "", oldPrefix: "", siteId: "" }, "basic");
}

function makeBlankConfig() {
	makeConfig({ env: "", url: "", oldPrefix: "", siteId: "" }, "blank");
}

/**
 * this is somewhat specific to pantheon
 * how can you run wp cli on your host from your local?
 * 
 * @param {*} usingOldConfig 
 */
async function makeRemoteConfig(usingOldConfig = false) {
	var config = usingOldConfig ? getConfig() : false;

	// this is somewhat specific to pantheon you might need to define other things to get data from your host if it is not pantheon
	let envDefault = config ? config.env : "";
	const env = await input({
		message: "To copy a multisite we need a place to copy it from, What is the pantheon environment you wish to copy from?",
		default: envDefault,
	});

	let siteIdDefault = config ? config.siteId : "";
	const siteId = await input({
		message: "What is the site ID of the site you wish to copy?",
		default: siteIdDefault,
	});

	let defaultUrl = config ? config.url : "";
	const url = await input({
		message: "What is the url of the site you wish to copy? example 'fuubar.unc.edu'",
		default: defaultUrl,
	});

	let defaultOldPrefix = config ? config.oldPrefix : "";
	const oldPrefix = await input({
		message: "What is the database prefix in the remote database of the site you wish to copy?",
		default: defaultOldPrefix,
	});

	if (env && siteId && url && oldPrefix) {
		makeConfig({ env: env, siteId: siteId, url: url, oldPrefix: oldPrefix });
	}
}

/**
 *  make the config file
 * @param {string} env
 * @param {string} siteId
 * @param {string} url
 * @param {string} oldPrefix
 * @param {array} plugins
 */
function makeConfig(options, type = false) {
	const path = ".wp-env-bin.json";
	const configTemplate = require("../templates/config.tpl");
	const config = configTemplate(options);
	let typeA = !type ? "" : type + " ";
	logger("> making a " + typeA + "config file at " + path + "\n");
	writeFileSync(path, config);
}

/**
 * make the htaccess file for the local wp-env
 */
function makeHtaccess(type = null) {
	const htaccessTemplate = require("../templates/htaccess.tpl");
	const config = getConfig();
	let makeRemoteHtaccess = false;
	//console.log(config);
	if (config && config.url && config.url !== "" && config.siteId && config.siteId !== "" && type !== "basic") {
		makeRemoteHtaccess = true;
	}
	// console.log( makeRemoteHtaccess )
	// console.log( type )
	if (makeRemoteHtaccess || type == "remote") {
		logger("> making htacess for " + config.url + " && " + config.siteId + "\n");
		const htaccess = htaccessTemplate(config.url, config.siteId);
		writeFileSync("./assets/wp-env/.htaccess", htaccess);
	} else {
		logger("> making basic htacess\n");
		const htaccess = htaccessTemplate(false, false);
		writeFileSync("./assets/wp-env/.htaccess", htaccess);
	}
}

/**
 * makes the data sent to the sql file
 * @param {sql} data
 */
function makeDB(data) {
	if (data) {
		writeFileSync("./assets/wp-env/database.sql", data);
	} else {
		console.error("no data to send to db file");
	}
}

module.exports = {
	command,
	help,
	makeBasicConfig,
	makeBlankConfig,
	makeConfig,
	makeDB,
	makeHtaccess,
	makeRemoteConfig,
};
