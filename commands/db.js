const { copyFileSync, readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { terminus_wp, wpcli } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { checkDatabase } = require("../lib/env/check");
const { readLocalConfig, readWpEnvJson, CONTAINER_ASSETS_PATH } = require("../lib/env/config");
const { renamePrefix } = require("../lib/db");
const { validateSqlFile } = require("../lib/db");

// ─── db get ──────────────────────────────────────────────────────────────────

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
			"wp-env-bin.config.json must have 'env' set to use 'db get'.\n" +
			"To use a local SQL file instead, run: wp-env-bin db use <path/to/file.sql>"
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

// ─── db use ──────────────────────────────────────────────────────────────────

/**
 * Validate a local SQL file and copy it to wp-env-bin/assets/database.sql
 * for use as the local database source. Prompts before overwriting an existing file.
 *
 * @param {string} filePath - Path to the SQL file provided by the user
 * @returns {Promise<void>}
 */
async function useDb(filePath) {
	if (!filePath) {
		throw new Error("Please provide a path: wp-env-bin db use <path/to/file.sql>");
	}

	const resolved = path.resolve(filePath);
	logger("> validating " + resolved + "...");
	validateSqlFile(resolved);
	logger("> validation passed (mysqldump header and WordPress options table found)");

	const dest = path.join(process.cwd(), "wp-env-bin/assets/database.sql");

	if (checkDatabase()) {
		const { select } = await import("@inquirer/prompts");
		const action = await select({
			message: "wp-env-bin/assets/database.sql already exists. What would you like to do?",
			choices: [
				{ name: "Replace it with the new file", value: "replace" },
				{ name: "Keep the existing file", value: "keep" },
			],
		});
		if (action === "keep") {
			logger("> keeping existing wp-env-bin/assets/database.sql");
			return;
		}
	}

	copyFileSync(resolved, dest);
	logger("> copied to wp-env-bin/assets/database.sql");
	logger("> run 'wp-env-bin db process' to import it into the local environment");
}

// ─── db process ──────────────────────────────────────────────────────────────

/**
 * Read database.sql, rename the table prefix throughout, and write the result
 * to database.modified.sql. Throws if the source file does not exist.
 *
 * @param {string} oldPrefix - The existing table prefix to replace (e.g. `wpsites_7_`)
 */
function prefixRenameFile(oldPrefix) {
	if (!checkDatabase()) {
		throw new Error("wp-env-bin/assets/database.sql not found. Run 'wp-env-bin db get' first.");
	}

	const sqlPath = path.join(process.cwd(), "wp-env-bin/assets/database.sql");
	const outPath = path.join(process.cwd(), "wp-env-bin/assets/database.modified.sql");

	logger("> reading database.sql...");
	const content = readFileSync(sqlPath, "utf8");

	const { modified, count } = renamePrefix(content, oldPrefix);

	writeFileSync(outPath, modified, "utf8");
	logger("> prefix rename: replaced " + count + " occurrences of '" + oldPrefix + "' with 'wp_'");
	logger("> written to wp-env-bin/assets/database.modified.sql");
}

/**
 * Import a SQL file into the local WordPress database via WP-CLI inside the Docker container.
 *
 * @param {string} [filename='database.modified.sql'] - SQL filename to import
 */
function importDb(filename) {
	const importPath = CONTAINER_ASSETS_PATH + "/" + (filename || "database.modified.sql");
	logger("> importing database from " + importPath + "...");
	wpcli("wp db import " + importPath);
	logger("> database imported.");
}

/**
 * Run WP-CLI search-replace to swap the live site URL for the local localhost URL
 * in the WordPress database. Handles both http:// and https:// variants.
 * Reads the local port from .wp-env.json, defaulting to 8889.
 *
 * @param {string} url - Live site domain (e.g. `example.com`)
 */
function searchReplace(url) {
	let port = 8889;
	try {
		const wpEnvJson = readWpEnvJson();
		port = (wpEnvJson.env && wpEnvJson.env.development && wpEnvJson.env.development.port) || port;
	} catch {
		logger("> could not read .wp-env.json, using default port " + port);
	}

	const local = "http://localhost:" + port;
	logger("> search-replace: https://" + url + " → " + local);
	wpcli("wp search-replace https://" + url + " " + local + " --report-changed-only");

	logger("> search-replace: http://" + url + " → " + local);
	wpcli("wp search-replace http://" + url + " " + local + " --report-changed-only");
}

/**
 * Create a local admin user (`admin` / `password`) in the WordPress database,
 * or reset the password and role if the user already exists.
 *
 * @returns {Promise<void>}
 */
async function createAdminUser(username, email, password) {
	try {
		wpcli(`wp user create ${username} ${email} --role=administrator --user_pass=${password}`);
		logger(`> created admin user (username: ${username}, password: ${password})`);
	} catch {
		wpcli(`wp user update ${username} --user_pass=${password} --role=administrator`);
		logger(`> reset admin user password to '${password}'`);
	}
}

/**
 * Full database processing pipeline: rename table prefix (multisite only),
 * import the SQL file into the local environment, run URL search-replace,
 * and optionally create a local admin user.
 *
 * @returns {Promise<void>}
 */
async function processDb() {
	const config = readLocalConfig();
	const { oldPrefix, url, siteType, adminUsername, adminEmail, adminPassword } = config;
	const username = adminUsername || "admin";
	const email = adminEmail || "admin@localhost.com";
	const password = adminPassword || "password";
	const resolvedSiteType = siteType || "singlesite";

	if (oldPrefix) {
		prefixRenameFile(oldPrefix);
		importDb("database.modified.sql");
	} else {
		importDb("database.sql");
	}
	searchReplace(url);

	const { select } = await import("@inquirer/prompts");
	const multisiteNote = resolvedSiteType === "multisite"
		? "\n  Note: user tables are not downloaded in multisite mode — a new user must be created."
		: "";
	const action = await select({
		message: `Would you like to create or reset a local admin user (${username} / ${password})?` + multisiteNote,
		choices: [
			{ name: "Yes, create or reset admin user", value: "yes" },
			{ name: "No, skip", value: "no" },
		],
	});
	if (action === "yes") {
		await createAdminUser(username, email, password);
	}
}

module.exports = { getRemoteDb, useDb, processDb };
