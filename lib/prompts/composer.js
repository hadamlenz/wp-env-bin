"use strict";

const { mkdirSync, readFileSync, writeFileSync } = require("fs");
const path = require("path");
const chalk = require("chalk");

const { composerMake } = require("../../commands/composer");
const { getProfileList } = require("../../commands/config");
const { matchActivePlugins, buildComposerJson, fetchRemoteData, makeComposerName } = require("../remote-composer");

async function handleComposerGet(runtimePath, runtimeUrl) {
	const profiles = getProfileList();
	if (!profiles || profiles.length === 0) {
		console.log(chalk.red("No profiles found in wp-env-bin/site-configs/."));
		console.log("Run `wp-env-bin config create` to create one.");
		return;
	}

	const { select: selComp, confirm: confComp, checkbox: checkboxComp } = await import("@inquirer/prompts");
	const chosenComp = await selComp({
		message: runtimeUrl
			? "Save fetched composer.json to which profile?"
			: "Build composer.json for which profile?",
		choices: profiles.map(p => ({ name: p, value: p })),
	});

	if (runtimeUrl) {
		console.log(chalk.cyan("> fetching " + runtimeUrl + "..."));
		let fetchedComposer;
		try {
			const https = require("https");
			const http = require("http");
			const client = runtimeUrl.startsWith("https") ? https : http;
			const raw = await new Promise((resolve, reject) => {
				let body = "";
				client.get(runtimeUrl, res => {
					res.on("data", chunk => { body += chunk; });
					res.on("end", () => resolve(body));
				}).on("error", reject);
			});
			fetchedComposer = JSON.parse(raw);
		} catch (err) {
			console.error(chalk.red("Failed to fetch composer.json: " + (err.message || err)));
			return;
		}

		const saveUrl = await confComp({
			message: "Save as site-configs/" + chosenComp + ".composer.json?",
			default: true,
		});
		if (saveUrl) {
			const dest = path.join(process.cwd(), "wp-env-bin");
			mkdirSync(path.join(dest, "site-configs"), { recursive: true });
			const outPath = path.join(dest, "site-configs", chosenComp + ".composer.json");
			writeFileSync(outPath, JSON.stringify(fetchedComposer, null, 4), "utf8");
			console.log(chalk.green("> saved site-configs/" + chosenComp + ".composer.json"));

			const copyActive = await confComp({ message: "Also copy to active wp-env-bin/composer.json?", default: false });
			if (copyActive) {
				writeFileSync(path.join(dest, "composer.json"), JSON.stringify(fetchedComposer, null, 4), "utf8");
				console.log(chalk.green("> copied to wp-env-bin/composer.json"));
			}
		}
		return;
	}

	// Remote WP-CLI path: active-plugin matching
	const profileFilePath = path.join(process.cwd(), "wp-env-bin", "site-configs", chosenComp + ".wp-env-bin.config.json");
	const profileConfig = JSON.parse(readFileSync(profileFilePath, "utf8"));
	const { env: compEnv, url: compUrl, composerPath: savedPath } = profileConfig;
	const composerPath = runtimePath || savedPath || null;

	if (!compEnv) {
		console.log(chalk.red("This profile has no 'env' set — cannot connect to a remote site."));
		console.log("Add it with `wp-env-bin config update`.");
		return;
	}
	if (!composerPath) {
		console.log(chalk.red("No composerPath set. Use --path /code/composer.json or add it to the profile with `wp-env-bin config update`."));
		return;
	}

	console.log(chalk.cyan("> fetching active plugins from " + compEnv + "..."));
	console.log(chalk.cyan("> reading " + composerPath + " from " + compEnv + "..."));
	let remoteData;
	try {
		remoteData = fetchRemoteData(profileConfig, compUrl, composerPath);
	} catch (err) {
		console.error(chalk.red("Failed to fetch remote data: " + (err.message || err)));
		return;
	}

	const { activePaths, themeSlug, serverComposer } = remoteData;

	const { matched: preMatched, unmatched: preUnmatched } = matchActivePlugins(activePaths, serverComposer);
	const allServerPkgs = {
		...((serverComposer && serverComposer.require) || {}),
		...((serverComposer && serverComposer["require-dev"]) || {}),
	};
	const themePkg = themeSlug
		? Object.keys(allServerPkgs).find(p => p.split("/")[1] === themeSlug) || null
		: null;

	console.log(chalk.cyan("\n> Matched packages (" + (Object.keys(preMatched).length + (themePkg ? 1 : 0)) + "):"));
	for (const [pkg, ver] of Object.entries(preMatched)) console.log(chalk.gray("    " + pkg + ": " + ver));
	if (themePkg) console.log(chalk.gray("    " + themePkg + ": * (active theme)"));
	if (preUnmatched.length > 0) {
		console.log(chalk.yellow("\n> Unmatched active plugins (not found in server composer.json — likely manually uploaded):"));
		for (const f of preUnmatched) console.log(chalk.gray("    " + f));
	}

	// Checkbox — let user deselect unwanted packages before saving
	// Exclude the project's own slug — it should be loaded via ".." in .wp-env.json, not composer
	const projectSlug = path.basename(process.cwd());
	const pluginChoices = Object.entries(preMatched)
		.filter(([pkg]) => !pkg.endsWith("/" + projectSlug))
		.map(([pkg, ver]) => ({
			name: pkg + " (" + ver + ")",
			value: pkg,
			checked: true,
		}));
	if (Object.keys(preMatched).some(pkg => pkg.endsWith("/" + projectSlug))) {
		console.log(chalk.yellow(`> Excluded ${projectSlug} from package list — load it via ".." in .wp-env.json instead.`));
	}
	if (themePkg && !themePkg.endsWith("/" + projectSlug)) {
		pluginChoices.push({ name: themePkg + ": * (active theme)", value: "__theme__", checked: true });
	}

	if (pluginChoices.length > 0) process.stdout.write("\x1Bc");
	const selected = pluginChoices.length > 0
		? await checkboxComp({
			message: "Select packages to include in composer.json (deselect to exclude):",
			choices: pluginChoices,
			pageSize: (process.stdout.rows || 24) - 4,
			loop: false,
		})
		: [];

	const filteredMatched = {};
	for (const pkg of selected) {
		if (pkg !== "__theme__" && preMatched[pkg] !== undefined) {
			filteredMatched[pkg] = preMatched[pkg];
		}
	}
	const filteredThemePkg = selected.includes("__theme__") ? themePkg : null;

	const saveComp = await confComp({ message: "Save as site-configs/" + chosenComp + ".composer.json?", default: true });
	if (saveComp) {
		const composerJson = buildComposerJson(filteredMatched, serverComposer.repositories || [], filteredThemePkg ? { [filteredThemePkg]: "*" } : null, makeComposerName(chosenComp));
		const compDest = path.join(process.cwd(), "wp-env-bin");
		mkdirSync(path.join(compDest, "site-configs"), { recursive: true });
		writeFileSync(path.join(compDest, "site-configs", chosenComp + ".composer.json"), JSON.stringify(composerJson, null, 4), "utf8");
		console.log(chalk.green("> saved site-configs/" + chosenComp + ".composer.json"));

		const copyActive = await confComp({ message: "Also copy to active wp-env-bin/composer.json?", default: false });
		if (copyActive) {
			writeFileSync(
				path.join(process.cwd(), "wp-env-bin", "composer.json"),
				JSON.stringify(composerJson, null, 4),
				"utf8"
			);
			console.log(chalk.green("> copied to wp-env-bin/composer.json"));
		}
	}
}

async function handleComposerMake() {
	const profiles = getProfileList();
	if (!profiles || profiles.length === 0) {
		console.log(chalk.red("No profiles found in wp-env-bin/site-configs/."));
		console.log("Run `wp-env-bin config create` to create one.");
		return;
	}

	const { select: selMake, confirm: confMake } = await import("@inquirer/prompts");
	const chosenMake = await selMake({
		message: "Create blank composer.json for which profile?",
		choices: profiles.map(p => ({ name: p, value: p })),
	});
	composerMake(chosenMake);

	const copyActiveMake = await confMake({ message: "Also copy to active wp-env-bin/composer.json?", default: false });
	if (copyActiveMake) {
		const srcPath = path.join(process.cwd(), "wp-env-bin", "site-configs", chosenMake + ".composer.json");
		writeFileSync(
			path.join(process.cwd(), "wp-env-bin", "composer.json"),
			readFileSync(srcPath, "utf8"),
			"utf8"
		);
		console.log(chalk.green("> copied to wp-env-bin/composer.json"));
	}
}

module.exports = { handleComposerGet, handleComposerMake };
