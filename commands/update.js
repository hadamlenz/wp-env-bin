const { readFileSync, writeFileSync } = require("fs");
const { getWpEnvJson } = require("./get");
const { logger } = require("./log");

function command(argv, conf) {
	switch (argv[3]) {
		case "help":
		case "--help":
		case "-h":
			help(conf.commandName, true);
			break;
		case "config":
			logger(argv);
			break;
		case "wp-env-json":
			updateWpEnvJson("fuu", "bar");
			break;
		case "wp-env-json-plugins":
			updateWpEnvJsonPlugins(conf);
			break;
		default:
			help(conf.commandName);
			break;
	}
}

/** the help command */
function help(commandName, log = false) {
	let msg = commandName + " update";
	msg += "- " + commandName + " update config [key] [value]";
	msg += "- " + commandName + " update wpenv-config [key] [value]";
	return logger(msg, log);
}

function updateConfig(key, value) {
	const file = readFileSync("./assets/wp-env/config.json");
	if (file) {
		const config = JSON.parse(file);
		config.config[key] = value;
		writeFileSync("./assets/wp-env/config.json", config);
	} else {
		console.error("> updateConfig: no config file can be found, make one first");
		return false;
	}
}

function updateWpEnvJson(key, value) {
	const file = readFileSync("./.wp-env.json");
	if (file) {
		const config = JSON.parse(file);
		config[key] = value;
		writeFileSync("./.wp-env.json", JSON.stringify(config));
	}
}

/**
 * update the plugins list
 */
function updateWpEnvJsonPlugins(conf) {
	let defs = conf.defaultPlugins;
	let pluginMap = defs.map((plugin) => {
		return "../../plugins/" + plugin;
	});
	//logger(pluginMap);
	if (pluginMap) {
		let wpEnvJson = get
		if (file) {
			const config = JSON.parse(file);
			updateWpEnvJson("plugins", pluginMap);
		}
	}
}

/**
 *
 * @param {boolean} mapToPluginsDir
 */
function updatePluginsDirMapping(mapToPluginsDir = true) {

}

/**
 * 
 * @param {bool} mapToHtaccess 
 */
function updateHtaccessPath(mapToHtaccess = true) {}

module.exports = {
	command,
	updateConfig,
	updateWpEnvJson,
};
