const { readFileSync } = require("fs");
const path = require("path");
const { terminus_wp } = require("./run");
const { logger } = require("./log");
const { checkDatabase } = require("./check");

/**
 * Read and validate wp-env-bin/wp-env.config.json from the current working directory.
 * Throws with a helpful message if the file is missing or required fields are absent.
 *
 * @returns {{ siteType: string, url: string, env?: string, oldPrefix?: string, siteId?: string, pluginName?: string, containerAssetsPath?: string }}
 */
function readLocalConfig() {
	let config;
	try {
		config = JSON.parse(
			readFileSync(path.join(process.cwd(), "wp-env-bin/wp-env.config.json"), "utf8")
		);
	} catch {
		throw new Error(
			"wp-env-bin/wp-env.config.json not found. Copy wp-env.config.json.example to wp-env-bin/wp-env.config.json and fill in your values."
		);
	}
	const siteType = config.siteType || "singlesite";
	const required = siteType === "multisite"
		? ["url", "oldPrefix", "siteId"]
		: ["url"];
	const missing = required.filter((k) => !config[k]);
	if (missing.length) {
		throw new Error(
			"wp-env-bin/wp-env.config.json is missing required fields: " +
				missing.join(", ") +
				". See wp-env.config.json.example."
		);
	}
	return config;
}

/**
 * Read the wp-env JSON config from the first file found among:
 * wp-env-bin/.wp-env.json, wp-env-bin/.wp-env.override.json, .wp-env.json
 * Throws if none are found.
 *
 * @returns {object} Parsed wp-env config object
 */
function readWpEnvJson() {
	const candidates = [
		"wp-env-bin/.wp-env.json",
		"wp-env-bin/.wp-env.override.json",
		".wp-env.json",
	];
	for (const candidate of candidates) {
		try {
			return JSON.parse(readFileSync(path.join(process.cwd(), candidate), "utf8"));
		} catch {
			// try next
		}
	}
	throw new Error("No wp-env config file found.");
}

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
 * Requires the `env` field to be set in wp-env.config.json.
 *
 * @returns {Promise<void>}
 */
async function getRemoteDb() {
	const config = readLocalConfig();
	const { env, url } = config;

	if (!env) {
		throw new Error(
			"wp-env.config.json must have 'env' set to use 'get db'.\n" +
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

module.exports = { readLocalConfig, readWpEnvJson, getRemoteTables, getRemoteDb };
