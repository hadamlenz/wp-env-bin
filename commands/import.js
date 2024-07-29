const { checkDatabase } = require("./check.js");
const { getConfig } = require("./get.js");
const { logger } = require("./log.js");
const { wpcli } = require("./run.js");

function command(subcommand, configProg) {
	//import data into wordpress
	const config = getConfig();
	switch (subcommand) {
		case "help":
		case "--help":
		case "-h":
			help(configProg.commandName, true);
			break;
		case "prefix-rename": {
			prefixRename(config);
			break;
		}
		case "remote-db": {
			importRemoteDb(config);
			break;
		}
		case "search-replace":{
			searchReplace(config,configProg);
			break;
		}
		default: {
			logger("> please clarify what you want to import, run " + configProg.commandName + " import help for more\n");
			break;
		}
	}
}

/** the help command */
function help(commandName, log = false) {
	let msg = commandName + " import : imports data into the container using the following subcommands\n";
	msg += "- " + commandName + " import remote-db : import db into a running wp-env\n";
	msg += "- " + commandName + " import prefix-rename : \n";
	return logger(msg, log);
}

/**
 *  imports the remote database, drops the old tables, changes the table prefix, search replaces it
 * @returns bool
 */
function importRemoteDb(config) {

	if (!checkDatabase()) {
		log("> the database file doesnt exist please place it at ./assets/wp-env/database.sql");
		return false;
	}

	if (config) {
		wpcli("wp db import ./wp-content/themes/" + config.themeName + "/assets/wp-env/database.sql");
		return true;
	}

	return false;
}


/**
 * rename the table prefixes from the old to wp_
 */
function prefixRename(config) {
	if (config && config.oldPrefix) {
		wpcli("wp db query < vendor/wp-env-bin/sql/change-table-prefix.sql");
		wpcli("wp db query 'DROP TABLE IF EXISTS wp_commentmeta,wp_comments,wp_links,wp_postmeta,wp_posts,wp_options,wp_term_relationships,wp_term_taxonomy,wp_termmeta,wp_terms'");
		wpcli("wp db query \"CALL change_wp_tables_prefix('wordpress','" + config.oldPrefix + "','wp_')\"");
		wpcli("wp search-replace " + config.oldPrefix + " wp_ --report-changed-only");
	} else {
		logger("> this is the wrong prefix " + config.oldPrefix);
	}
}

/**
 * run the search replace on the db in the container
 * @param {*} config 
 * @param {*} conf 
 */
function searchReplace(config) {
		wpcli("wp search-replace https://" + config.url + " http://localhost:8888 --report-changed-only");
}

module.exports = {
	command,
	help,
	importRemoteDb,
	prefixRename,
};
