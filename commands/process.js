const { readFileSync, writeFileSync } = require("fs");
const path = require("path");
const { wpcli } = require("./run");
const { logger } = require("./log");
const { checkDatabase } = require("./check");
const { readLocalConfig, readWpEnvJson } = require("./get");

function renamePrefix(content, oldPrefix) {
	const escaped = oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const count = (content.match(new RegExp(escaped, "g")) || []).length;
	const modified = content.split(oldPrefix).join("wp_");
	return { modified, count };
}

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

function importDb(containerAssetsPath, filename) {
	const importPath = containerAssetsPath + "/" + (filename || "database.modified.sql");
	logger("> importing database from " + importPath + "...");
	wpcli("wp db import " + importPath);
	logger("> database imported.");
}

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

async function createAdminUser() {
	try {
		wpcli("wp user create admin admin@localhost.com --role=administrator --user_pass=password");
		logger("> created admin user (username: admin, password: password)");
	} catch {
		wpcli("wp user update admin --user_pass=password --role=administrator");
		logger("> reset admin user password to 'password'");
	}
}

async function processDb() {
	const config = readLocalConfig();
	const { oldPrefix, url, containerAssetsPath, siteType } = config;
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
		message: "Would you like to create or reset a local admin user (admin / password)?" + multisiteNote,
		choices: [
			{ name: "Yes, create or reset admin user", value: "yes" },
			{ name: "No, skip", value: "no" },
		],
	});
	if (action === "yes") {
		await createAdminUser();
	}
}

module.exports = { renamePrefix, prefixRenameFile, importDb, searchReplace, processDb };
