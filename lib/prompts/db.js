"use strict";

const chalk = require("chalk");

const { getRemoteDb, processDb, useDb } = require("../../commands/db");
const { checkDatabase } = require("../env/check");
const { isWpEnvRunning } = require("../env/check");
const { readLocalConfig } = require("../env/config");
const { runWpEnv } = require("../../commands/env");

async function handleDbGet() {
	let action = "redownload";
	if (checkDatabase()) {
		const { select } = await import("@inquirer/prompts");
		action = await select({
			message: "wp-env-bin/assets/database.sql already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing database", value: "useIt" },
				{ name: "Re-download from remote host", value: "redownload" },
			],
		});
	}
	await getRemoteDb({ action });
}

async function handleDbProcess() {
	if (!isWpEnvRunning()) {
		const { confirm } = await import("@inquirer/prompts");
		const shouldStart = await confirm({
			message: "The wp-env environment is not running. Start it now with wp-env-bin env start?",
			default: true,
		});
		if (shouldStart) {
			runWpEnv(["start"]);
		} else {
			console.log(chalk.yellow("Skipping db process — start the environment first with: wp-env-bin env start"));
			process.exit(0);
		}
	}
	const { select } = await import("@inquirer/prompts");
	const config = readLocalConfig();
	const username = config.adminUsername || "admin";
	const password = config.adminPassword || "password";
	const siteType = config.siteType || "singlesite";
	const multisiteNote = siteType === "multisite"
		? "\n  Note: user tables are not downloaded in multisite mode — a new user must be created."
		: "";
	const answer = await select({
		message: `Would you like to create or reset a local admin user (${username} / ${password})?` + multisiteNote,
		choices: [
			{ name: "Yes, create or reset admin user", value: "yes" },
			{ name: "No, skip", value: "no" },
		],
	});
	await processDb({ createAdmin: answer === "yes" });
}

async function handleDbUse(filePath) {
	let action = "replace";
	if (checkDatabase()) {
		const { select } = await import("@inquirer/prompts");
		action = await select({
			message: "wp-env-bin/assets/database.sql already exists. What would you like to do?",
			choices: [
				{ name: "Replace it with the new file", value: "replace" },
				{ name: "Keep the existing file", value: "keep" },
			],
		});
	}
	useDb(filePath, { action });
}

module.exports = { handleDbGet, handleDbProcess, handleDbUse };
