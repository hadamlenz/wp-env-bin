const { readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { wpcli } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { checkDatabase } = require("../lib/env/check");
const { readLocalConfig, readWpEnvJson } = require("../lib/env/config");
const { renamePrefix } = require("../lib/db");

/**
 * Read database.sql, rename the table prefix throughout, and write the result
 * to database.modified.sql. Throws if the source file does not exist.
 *
 * @param {string} oldPrefix - The existing table prefix to replace (e.g. `wpsites_7_`)
 */
function prefixRenameFile(oldPrefix) {
	if (!checkDatabase()) {
		throw new Error("wp-env-bin/assets/database.sql not found. Run 'wp-env-bin get db' first.");
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
 * @param {string} containerAssetsPath - Path to the assets directory inside the container
 * @param {string} [filename='database.modified.sql'] - SQL filename to import
 */
function importDb(containerAssetsPath, filename) {
	const importPath = containerAssetsPath + "/" + (filename || "database.modified.sql");
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
	const { oldPrefix, url, containerAssetsPath, siteType, adminUsername, adminEmail, adminPassword } = config;
	const username = adminUsername || "admin";
	const email = adminEmail || "admin@localhost.com";
	const password = adminPassword || "password";
	const resolvedSiteType = siteType || "singlesite";

	if (oldPrefix) {
		prefixRenameFile(oldPrefix);
		importDb(containerAssetsPath, "database.modified.sql");
	} else {
		importDb(containerAssetsPath, "database.sql");
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

module.exports = { prefixRenameFile, importDb, searchReplace, processDb };
