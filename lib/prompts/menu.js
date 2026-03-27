"use strict";

const { select, intro, outro, isCancel, cancel, note } = require("@clack/prompts");

const { envSyncPrompt } = require("./env");
const { dbGetPrompt, dbProcessPrompt } = require("./db");
const {
	configCreatePrompt,
	configSwitchPrompt,
	configUpdatePrompt,
	configInstallPrompt,
} = require("./config");
const { e2eScaffoldPrompt } = require("./e2e");
const { composerGetPrompt, composerMakePrompt } = require("./composer");
const { htaccessMakePrompt } = require("./htaccess");
const { visualComparePrompt } = require("./visual");
const { runWpEnv } = require("../../commands/env");
const { generateE2eTests, runE2eTests } = require("../../commands/e2e");
const { scaffoldCommand } = require("../../commands/scaffold");
const { cleanAll } = require("../../commands/clean");
const path = require("path");

// ─── Category sub-menus ────────────────────────────────────────────────────────

async function environmentMenu() {
	const action = await select({
		message: "Environment — what would you like to do?",
		options: [
			{ value: "sync-start", label: "Sync & Start", hint: "sync DB then start wp-env" },
			{ value: "sync",       label: "Sync DB",       hint: "wp-env-bin env sync" },
			{ value: "start",      label: "Start",         hint: "wp-env-bin env start" },
			{ value: "stop",       label: "Stop",          hint: "wp-env-bin env stop" },
			{ value: "restart",    label: "Restart",       hint: "wp-env-bin env restart" },
		],
	});
	if (isCancel(action)) return;

	switch (action) {
		case "sync-start":
			await envSyncPrompt();
			runWpEnv(["start"]);
			break;
		case "sync":
			await envSyncPrompt();
			break;
		case "start":
			runWpEnv(["start"]);
			break;
		case "stop":
			runWpEnv(["stop"]);
			break;
		case "restart":
			runWpEnv(["stop"]);
			runWpEnv(["start"]);
			break;
	}
}

async function databaseMenu() {
	const action = await select({
		message: "Database — what would you like to do?",
		options: [
			{ value: "get",     label: "Get remote DB",    hint: "wp-env-bin db get" },
			{ value: "process", label: "Process / import", hint: "wp-env-bin db process" },
		],
	});
	if (isCancel(action)) return;

	switch (action) {
		case "get":
			await dbGetPrompt();
			break;
		case "process":
			await dbProcessPrompt();
			break;
	}
}

async function configMenu() {
	const action = await select({
		message: "Config — what would you like to do?",
		options: [
			{ value: "create",  label: "Create config",  hint: "wp-env-bin config create" },
			{ value: "switch",  label: "Switch profile", hint: "wp-env-bin config switch" },
			{ value: "update",  label: "Update config",  hint: "wp-env-bin config update" },
			{ value: "install", label: "Install config", hint: "wp-env-bin config install" },
		],
	});
	if (isCancel(action)) return;

	switch (action) {
		case "create":
			await configCreatePrompt();
			break;
		case "switch":
			await configSwitchPrompt();
			break;
		case "update":
			await configUpdatePrompt();
			break;
		case "install":
			await configInstallPrompt();
			break;
	}
}

async function e2eMenu() {
	const action = await select({
		message: "E2E Testing — what would you like to do?",
		options: [
			{ value: "scaffold",  label: "Scaffold E2E",    hint: "wp-env-bin e2e scaffold" },
			{ value: "generate",  label: "Generate tests",  hint: "wp-env-bin e2e generate" },
			{ value: "test",      label: "Run tests",       hint: "wp-env-bin e2e test" },
		],
	});
	if (isCancel(action)) return;

	switch (action) {
		case "scaffold":
			await e2eScaffoldPrompt();
			break;
		case "generate":
			generateE2eTests([]);
			break;
		case "test":
			runE2eTests([]);
			break;
	}
}

async function advancedMenu() {
	const action = await select({
		message: "Advanced — what would you like to do?",
		options: [
			{ value: "composer-get",  label: "Composer — get package",  hint: "wp-env-bin composer get" },
			{ value: "composer-make", label: "Composer — make config",  hint: "wp-env-bin composer make" },
			{ value: "htaccess",      label: "Make .htaccess",          hint: "wp-env-bin htaccess make" },
			{ value: "scaffold",      label: "Scaffold project",        hint: "wp-env-bin scaffold" },
			{ value: "visual",        label: "Visual compare",          hint: "wp-env-bin visual compare" },
			{ value: "clean",         label: "Clean all",               hint: "wp-env-bin clean all" },
		],
	});
	if (isCancel(action)) return;

	switch (action) {
		case "composer-get":
			await composerGetPrompt();
			break;
		case "composer-make":
			await composerMakePrompt();
			break;
		case "htaccess":
			await htaccessMakePrompt();
			break;
		case "scaffold": {
			const dest = path.join(process.cwd(), "wp-env-bin");
			scaffoldCommand(dest);
			break;
		}
		case "visual":
			await visualComparePrompt([]);
			break;
		case "clean":
			cleanAll();
			break;
	}
}

// ─── Top-level menu ────────────────────────────────────────────────────────────

async function menuPrompt() {
	console.clear();
	intro("  wp-env-bin  ");

	const category = await select({
		message: "What would you like to do?",
		options: [
			{ value: "environment", label: "Environment", hint: "sync, start, stop" },
			{ value: "database",    label: "Database",    hint: "get remote DB, process / import" },
			{ value: "config",      label: "Config",      hint: "create, switch, update profiles" },
			{ value: "e2e",         label: "E2E Testing", hint: "scaffold, generate, run tests" },
			{ value: "advanced",    label: "Advanced",    hint: "composer, htaccess, scaffold, visual, clean" },
		],
	});

	if (isCancel(category)) {
		cancel("Cancelled.");
		process.exit(0);
	}

	switch (category) {
		case "environment":
			await environmentMenu();
			break;
		case "database":
			await databaseMenu();
			break;
		case "config":
			await configMenu();
			break;
		case "e2e":
			await e2eMenu();
			break;
		case "advanced":
			await advancedMenu();
			break;
	}

	outro("Done.");
}

module.exports = { menuPrompt };
