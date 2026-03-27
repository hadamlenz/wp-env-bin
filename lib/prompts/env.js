"use strict";

const { getRemoteDb, processDb } = require("../../commands/db");
const { makeHtaccess } = require("../../commands/htaccess");
const { getInactivePlugins, activateComposerPlugins } = require("../../commands/plugins");
const { checkDatabase, checkHtaccess } = require("../env/check");
const { readLocalConfig } = require("../env/config");

async function handleEnvSync() {
	// db get
	let dbAction = "redownload";
	if (checkDatabase()) {
		const { select } = await import("@inquirer/prompts");
		dbAction = await select({
			message: "wp-env-bin/assets/database.sql already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing database", value: "useIt" },
				{ name: "Re-download from remote host", value: "redownload" },
			],
		});
	}
	await getRemoteDb({ action: dbAction });

	// db process
	const { select: selectProcess } = await import("@inquirer/prompts");
	const config = readLocalConfig();
	const username = config.adminUsername || "admin";
	const password = config.adminPassword || "password";
	const siteType = config.siteType || "singlesite";
	const multisiteNote = siteType === "multisite"
		? "\n  Note: user tables are not downloaded in multisite mode — a new user must be created."
		: "";
	const processAnswer = await selectProcess({
		message: `Would you like to create or reset a local admin user (${username} / ${password})?` + multisiteNote,
		choices: [
			{ name: "Yes, create or reset admin user", value: "yes" },
			{ name: "No, skip", value: "no" },
		],
	});
	await processDb({ createAdmin: processAnswer === "yes" });

	// htaccess make
	let htaccessAction = "regenerate";
	if (checkHtaccess()) {
		const { select: selectHtaccess } = await import("@inquirer/prompts");
		htaccessAction = await selectHtaccess({
			message: "wp-env-bin/assets/.htaccess already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing .htaccess", value: "useIt" },
				{ name: "Regenerate from current config", value: "regenerate" },
			],
		});
	}
	makeHtaccess({ action: htaccessAction });

	// plugins
	const inactivePlugins = getInactivePlugins();
	if (inactivePlugins.length > 0) {
		const { select: selectPlugins } = await import("@inquirer/prompts");
		const pluginAnswer = await selectPlugins({
			message: `These composer plugins are inactive: ${inactivePlugins.join(", ")}. Activate them now?`,
			choices: [
				{ name: "Yes, activate all", value: "yes" },
				{ name: "No, skip", value: "no" },
			],
		});
		if (pluginAnswer === "yes") {
			activateComposerPlugins(inactivePlugins);
		}
	}
}

module.exports = { handleEnvSync };
