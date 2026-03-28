import chalk from "chalk";
import { select, confirm } from "@inquirer/prompts";

import { getRemoteDb, processDb, useDb } from "../../commands/db.js";
import { checkDatabase, isWpEnvRunning } from "../env/check.js";
import { readLocalConfig } from "../env/config.js";
import { runWpEnv } from "../../commands/env.js";

async function dbGetPrompt() {
	let action = "redownload";
	if (checkDatabase()) {
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

async function dbProcessPrompt() {
	if (!isWpEnvRunning()) {
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

async function dbUsePrompt(filePath) {
	let action = "replace";
	if (checkDatabase()) {
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

export { dbGetPrompt, dbProcessPrompt, dbUsePrompt };
