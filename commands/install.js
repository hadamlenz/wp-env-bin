const { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { logger } = require("./log");

async function install() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const scaffold = path.join(__dirname, "../scaffold");

	let projectName = "";
	try {
		const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
		projectName = pkg.name || "";
	} catch {
		// no package.json in consuming project, leave blank
	}

	mkdirSync(path.join(dest, "assets"), { recursive: true });
	mkdirSync(path.join(dest, "plugins/wp-env-bin-plugin/classes"), { recursive: true });

	// Scaffold dotfiles are stored without a leading dot so npm includes them
	// in the published package. They are copied here with their correct names.
	const files = [
		{ src: "wp-env.json",        dest: ".wp-env.json" },
		{ src: "gitignore",          dest: ".gitignore" },
		{ src: "assets/gitkeep",     dest: "assets/.gitkeep" },
		{ src: "plugins/wp-env-bin-plugin/wp-env-bin-plugin.php",         dest: "plugins/wp-env-bin-plugin/wp-env-bin-plugin.php" },
		{ src: "plugins/wp-env-bin-plugin/classes/class-service-worker.php", dest: "plugins/wp-env-bin-plugin/classes/class-service-worker.php" },
		{ src: "wp-env.config.json.example", dest: "wp-env.config.json.example" },
		{ src: "composer.json.example",      dest: "composer.json.example" },
	];

	for (const file of files) {
		const destPath = path.join(dest, file.dest);
		if (!existsSync(destPath)) {
			copyFileSync(path.join(scaffold, file.src), destPath);
			logger("> created wp-env-bin/" + file.dest);
		} else {
			logger("> skipped wp-env-bin/" + file.dest + " (already exists)");
		}
	}

	const { confirm, select, input } = await import("@inquirer/prompts");
	const configPath = path.join(dest, "wp-env.config.json");
	let existingConfig = null;
	let shouldConfigure = false;

	if (existsSync(configPath)) {
		try {
			existingConfig = JSON.parse(readFileSync(configPath, "utf8"));
		} catch {
			// malformed config, treat as missing
		}
		const action = await select({
			message: "wp-env.config.json already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing config", value: "useIt" },
				{ name: "Reconfigure using existing values as defaults", value: "editIt" },
				{ name: "Start over with a fresh config", value: "destroyIt" },
			],
		});
		if (action === "useIt") {
			logger("> using existing wp-env-bin/wp-env.config.json");
			logger("\nNext steps:");
			if (!existsSync(path.join(dest, "composer.json"))) {
				logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
				logger("  # Edit composer.json to add your plugin and theme dependencies");
			}
			logger("  npm run env:setup");
			logger("\nAdd these scripts to your project package.json for visual regression testing:");
			logger('  "env:compare":      "wp-env-bin compare --url /"');
			logger('  "env:compare:page": "wp-env-bin compare --url /your-page-path/"');
			logger("  Then run: npx playwright install chromium  (one-time browser install)");
			return;
		}
		shouldConfigure = true;
		if (action === "destroyIt") {
			existingConfig = null;
		}
	} else {
		shouldConfigure = await confirm({
			message: "Configure wp-env.config.json now?",
			default: true,
		});
	}

	if (!shouldConfigure) {
		logger("\nNext steps:");
		logger("  cp wp-env-bin/wp-env.config.json.example wp-env-bin/wp-env.config.json");
		logger("  # Edit wp-env.config.json with your env, url, oldPrefix, siteId");
		if (!existsSync(path.join(dest, "composer.json"))) {
			logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
			logger("  # Edit composer.json to add your plugin and theme dependencies");
		}
		logger("  npm run env:setup");
		logger("\nAdd these scripts to your project package.json for visual regression testing:");
		logger('  "env:compare":      "wp-env-bin compare --url /"');
		logger('  "env:compare:page": "wp-env-bin compare --url /your-page-path/"');
		logger("  Then run: npx playwright install chromium  (one-time browser install)");
		return;
	}

	const defaults = existingConfig || {};

	const projectType = await select({
		message: "Is this a plugin or a theme?",
		choices: [
			{ name: "Plugin", value: "plugin" },
			{ name: "Theme", value: "theme" },
		],
		default: defaults.projectType || "plugin",
	});

	const siteType = await select({
		message: "Site type?",
		choices: [
			{ name: "Single-site", value: "singlesite" },
			{ name: "Multisite (Pantheon subsite)", value: "multisite" },
		],
		default: defaults.siteType || "singlesite",
	});

	const env = await input({
		message: "Pantheon site.environment (e.g. my-site.live)",
		default: defaults.env || "",
	});

	const url = await input({
		message: "Live site URL (e.g. mysite.unc.edu)",
		default: defaults.url || "",
	});

	const pluginName = await input({
		message: "Plugin or theme name (for reference)",
		default: defaults.pluginName || projectName,
	});

	const config = {
		commandName: "wp-env-bin",
		pluginName,
		containerAssetsPath: "/var/www/html/wp-content/wp-env-bin",
		projectType,
		siteType,
		env,
		url,
	};

	if (siteType === "multisite") {
		config.oldPrefix = await input({
			message: "Live DB table prefix (e.g. wp_123_)",
			default: defaults.oldPrefix || "",
		});
		config.siteId = await input({
			message: "Multisite site ID",
			default: defaults.siteId || "",
		});
	}

	writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> created wp-env-bin/wp-env.config.json");

	const wpEnvPath = path.join(dest, ".wp-env.json");
	try {
		const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
		if (projectType === "theme") {
			delete wpEnv.plugins;
			wpEnv.themes = [".."];
		} else {
			delete wpEnv.themes;
			wpEnv.plugins = [".."];
		}
		writeFileSync(wpEnvPath, JSON.stringify(wpEnv, null, 4), "utf8");
		logger("> updated wp-env-bin/.wp-env.json (" + projectType + ")");
	} catch {
		// .wp-env.json missing or malformed — leave it as-is
	}

	logger("\nNext steps:");
	if (!existsSync(path.join(dest, "composer.json"))) {
		logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
		logger("  # Edit composer.json to add your plugin and theme dependencies");
	}
	logger("  npm run env:setup");
	logger("\nAdd these scripts to your project package.json for visual regression testing:");
	logger('  "env:compare":      "wp-env-bin compare --url /"');
	logger('  "env:compare:page": "wp-env-bin compare --url /your-page-path/"');
	logger("  Then run: npx playwright install chromium  (one-time browser install)");
}

module.exports = { install };
