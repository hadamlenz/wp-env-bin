const path = require("path");
const { terminus_wp } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { checkDatabase } = require("../lib/env/check");
const { readLocalConfig, readWpEnvJson } = require("../lib/env/config");

/**
 * Fetch the list of database tables for a given Pantheon site environment and URL via Terminus.
 *
 * @param {string} env - Pantheon site.environment (e.g. `mysite.live`)
 * @param {string} url - Live site URL used as the --url flag for WP-CLI
 * @returns {string} Comma-separated list of table names
 */
async function getRemoteTables(env, url) {
	logger("> fetching remote table list from " + env + " (" + url + ")...");
	const result = terminus_wp(
		env,
		"db tables --format=csv --url=" + url + " --all-tables-with-prefix",
		{ encoding: "utf8" }
	);
	return result.trim();
}

/**
 * Export the site database from Pantheon via Terminus and save it to
 * wp-env-bin/assets/database.sql. Prompts to reuse an existing export if present.
 * Requires the `env` field to be set in wp-env-bin.config.json.
 *
 * @returns {Promise<void>}
 */
async function getRemoteDb() {
	const config = readLocalConfig();
	const { env, url } = config;

	if (!env) {
		throw new Error(
			"wp-env-bin.config.json must have 'env' set to use 'get db'.\n" +
			"To use a local SQL file instead, run: wp-env-bin use db <path/to/file.sql>"
		);
	}

	if (checkDatabase()) {
		const { select } = await import("@inquirer/prompts");
		const action = await select({
			message: "wp-env-bin/assets/database.sql already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing database", value: "useIt" },
				{ name: "Re-download from Pantheon", value: "destroyIt" },
			],
		});
		if (action === "useIt") {
			logger("> using existing wp-env-bin/assets/database.sql");
			return;
		}
	}

	const tables = await getRemoteTables(env, url);
	logger("> found tables: " + tables);

	const outPath = "./wp-env-bin/assets/database.sql";
	logger("> exporting database to " + outPath + "...");

	terminus_wp(
		env,
		"db export - --url=" + url + " --tables=" + tables + " > " + outPath,
		{ shell: true }
	);

	if (checkDatabase()) {
		logger("> database exported successfully.");
	} else {
		throw new Error("Database export failed — wp-env-bin/assets/database.sql not found.");
	}
}

module.exports = { getRemoteTables, getRemoteDb };
