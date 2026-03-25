const { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { logger } = require("../lib/utils/log");
const { applyProjectType } = require("../lib/config");

/**
 * Return the current install-time filesystem context so the caller (bin) can
 * decide which prompts to show before calling install().
 *
 * @returns {{ dest: string, configPath: string, configExists: boolean, existingConfig: object|null, projectName: string }}
 */
function getInstallContext() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const configPath = path.join(dest, "wp-env-bin.config.json");
	const configExists = existsSync(configPath);

	let existingConfig = null;
	if (configExists) {
		try {
			existingConfig = JSON.parse(readFileSync(configPath, "utf8"));
		} catch {
			// malformed config, treat as missing
		}
	}

	let projectName = "";
	try {
		const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
		projectName = pkg.name || "";
	} catch {
		// no package.json in consuming project
	}

	return { dest, configPath, configExists, existingConfig, projectName };
}

/**
 * Scaffold the wp-env-bin/ config folder in the consuming project and,
 * when action is "configure", write wp-env-bin.config.json using the
 * supplied config values. All interactive decisions must be made by the
 * caller before invoking this function.
 *
 * @param {object} options
 * @param {"useIt"|"configure"|"skip"} options.action
 *   - "useIt"     — keep the existing config, just print next steps
 *   - "configure" — write a fresh config from options.config
 *   - "skip"      — scaffold files but skip config; print manual steps
 * @param {object} [options.config] - Config values (required when action === "configure")
 * @returns {void}
 */
function install({ action, config } = {}) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const scaffold = path.join(__dirname, "../scaffold");

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
		{ src: "wp-env-bin.config.json.example", dest: "wp-env-bin.config.json.example" },
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

	if (action === "useIt") {
		logger("> using existing wp-env-bin/wp-env-bin.config.json");
		logger("\nNext steps:");
		if (!existsSync(path.join(dest, "composer.json"))) {
			logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
			logger("  # Edit composer.json to add your plugin and theme dependencies");
		}
		logger("  wp-env-bin env setup");
		return;
	}

	if (action === "skip") {
		logger("\nNext steps:");
		logger("  cp wp-env-bin/wp-env-bin.config.json.example wp-env-bin/wp-env-bin.config.json");
		logger("  # Edit wp-env-bin.config.json with your env, url, oldPrefix, siteId");
		if (!existsSync(path.join(dest, "composer.json"))) {
			logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
			logger("  # Edit composer.json to add your plugin and theme dependencies");
		}
		logger("  wp-env-bin env setup");
		return;
	}

	// action === "configure"
	const configPath = path.join(dest, "wp-env-bin.config.json");
	writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> created wp-env-bin/wp-env-bin.config.json");

	const wpEnvPath = path.join(dest, ".wp-env.json");
	try {
		const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
		const updatedWpEnv = applyProjectType(wpEnv, config.projectType);
		writeFileSync(wpEnvPath, JSON.stringify(updatedWpEnv, null, 4), "utf8");
		logger("> updated wp-env-bin/.wp-env.json (" + config.projectType + ")");
	} catch {
		// .wp-env.json missing or malformed — leave it as-is
	}

	logger("\nNext steps:");
	if (!existsSync(path.join(dest, "composer.json"))) {
		logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
		logger("  # Edit composer.json to add your plugin and theme dependencies");
	}
	logger("  wp-env-bin env setup");
}

module.exports = { install, getInstallContext };
