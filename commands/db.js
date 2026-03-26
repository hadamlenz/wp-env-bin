const { copyFileSync, readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { terminus_wp, wpcli } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { checkDatabase, requireDir } = require("../lib/env/check");
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
	logger("> fetching remote table list from " + env + " (" + url + ")...", true, "info");
	const result = terminus_wp(
		env,
		"db tables --format=csv --url=" + url + " --all-tables-with-prefix",
		{ encoding: "utf8" }
	);
	return result.trim();
}

/**
 * Export the site database from Pantheon via Terminus and save it to
 * wp-env-bin/assets/database.sql. The caller is responsible for checking
 * whether a database already exists and prompting the user before calling
 * this function.
 *
 * @param {object} [options]
 * @param {"useIt"|"redownload"} [options.action="redownload"]
 *   - "useIt"      — skip the download and reuse the existing file
 *   - "redownload" — always fetch from Pantheon (default)
 * @returns {Promise<void>}
 */
async function getRemoteDb({ action = "redownload" } = {}) {
	const config = readLocalConfig();
	const { env, url } = config;

	if (!env) {
		throw new Error(
			"wp-env-bin.config.json must have 'env' set to use 'db get'.\n" +
			"To use a local SQL file instead, run: wp-env-bin db use <path/to/file.sql>"
		);
	}

	if (action === "useIt") {
		logger("> using existing wp-env-bin/assets/database.sql", true, "info");
		return;
	}

	const tables = await getRemoteTables(env, url);
	logger("> found tables: " + tables, true, "info");

	const outPath = "./wp-env-bin/assets/database.sql";
	logger("> exporting database to " + outPath + "...", true, "info");

	terminus_wp(
		env,
		"db export - --url=" + url + " --tables=" + tables + " > " + outPath,
		{ shell: true }
	);

	if (checkDatabase()) {
		logger("> database exported successfully.", true, "success");
	} else {
		throw new Error("Database export failed — wp-env-bin/assets/database.sql not found.");
	}
}

// ─── db use ──────────────────────────────────────────────────────────────────

/**
 * Validate a local SQL file and copy it to wp-env-bin/assets/database.sql
 * for use as the local database source. The caller is responsible for
 * checking whether a database already exists and prompting the user before
 * calling this function.
 *
 * @param {string} filePath - Path to the SQL file provided by the user
 * @param {object} [options]
 * @param {"replace"|"keep"} [options.action="replace"]
 *   - "replace" — overwrite the existing file (default)
 *   - "keep"    — leave the existing file in place and return early
 * @returns {void}
 */
function useDb(filePath, { action = "replace" } = {}) {
	if (!filePath) {
		throw new Error("Please provide a path: wp-env-bin db use <path/to/file.sql>");
	}

	const resolved = path.resolve(filePath);
	logger("> validating " + resolved + "...", true, "info");
	validateSqlFile(resolved);
	logger("> validation passed (mysqldump header and WordPress options table found)", true, "success");

	requireDir(path.join(process.cwd(), "wp-env-bin/assets"), "Run `wp-env-bin env setup` first to initialize the wp-env-bin/ directory.");
	const dest = path.join(process.cwd(), "wp-env-bin/assets/database.sql");

	if (action === "keep") {
		logger("> keeping existing wp-env-bin/assets/database.sql", true, "info");
		return;
	}

	copyFileSync(resolved, dest);
	logger("> copied to wp-env-bin/assets/database.sql", true, "success");
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

	logger("> reading database.sql...", true, "info");
	const content = readFileSync(sqlPath, "utf8");

	const { modified, count } = renamePrefix(content, oldPrefix);

	writeFileSync(outPath, modified, "utf8");
	logger("> prefix rename: replaced " + count + " occurrences of '" + oldPrefix + "' with 'wp_'", true, "success");
	logger("> written to wp-env-bin/assets/database.modified.sql", true, "success");
}

/**
 * Import a SQL file into the local WordPress database via WP-CLI inside the Docker container.
 *
 * @param {string} [filename='database.modified.sql'] - SQL filename to import
 */
function importDb(filename) {
	const importPath = CONTAINER_ASSETS_PATH + "/" + (filename || "database.modified.sql");
	logger("> importing database from " + importPath + "...", true, "info");
	wpcli("wp db import " + importPath);
	logger("> database imported.", true, "success");
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
		logger("> could not read .wp-env.json, using default port " + port, true, "warn");
	}

	const local = "http://localhost:" + port;
	logger("> search-replace: https://" + url + " → " + local, true, "info");
	wpcli("wp search-replace https://" + url + " " + local + " --report-changed-only");

	logger("> search-replace: http://" + url + " → " + local, true, "info");
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
		logger(`> created admin user (username: ${username}, password: ${password})`, true, "success");
	} catch {
		wpcli(`wp user update ${username} --user_pass=${password} --role=administrator`);
		logger(`> reset admin user password to '${password}'`, true, "success");
	}
}

/**
 * Full database processing pipeline: rename table prefix (multisite only),
 * import the SQL file into the local environment, run URL search-replace,
 * and optionally create a local admin user. The caller is responsible for
 * prompting the user before passing createAdmin.
 *
 * @param {object} [options]
 * @param {boolean} [options.createAdmin=false] - Whether to create/reset the local admin user
 * @returns {Promise<void>}
 */
async function processDb({ createAdmin = false } = {}) {
	const config = readLocalConfig();
	const { oldPrefix, url, adminUsername, adminEmail, adminPassword } = config;
	const username = adminUsername || "admin";
	const email = adminEmail || "admin@localhost.com";
	const password = adminPassword || "password";

	if (oldPrefix) {
		prefixRenameFile(oldPrefix);
		importDb("database.modified.sql");
	} else {
		importDb("database.sql");
	}
	searchReplace(url);

	if (createAdmin) {
		await createAdminUser(username, email, password);
	}
}

module.exports = { getRemoteDb, useDb, processDb };
