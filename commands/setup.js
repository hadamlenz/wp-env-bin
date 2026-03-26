const path = require("path");
const fs = require("fs");
const { run } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { requireDir, cleanStaleProjectDirs } = require("../lib/env/check");

const PLUGIN_FILES = [
	"wp-env-bin-plugin.php",
	"classes/class-service-worker.php",
];

/**
 * Run `composer install` inside the wp-env-bin/ directory to install
 * the PHP plugin and theme dependencies declared in composer.json.
 *
 * @param {string[]} argv - CLI args (supports --delete-lock)
 */
function setup(argv = []) {
	const composerDir = path.join(process.cwd(), "wp-env-bin");
	requireDir(composerDir, "Run this command from your project root (the directory containing wp-env-bin/).");

	if (argv.includes("--delete-lock")) {
		const lockFile = path.join(composerDir, "composer.lock");
		if (fs.existsSync(lockFile)) {
			fs.unlinkSync(lockFile);
			logger("> deleted composer.lock", true, "success");
		} else {
			logger("> composer.lock not found, skipping delete", true, "muted");
		}
	}

	cleanStaleProjectDirs(composerDir);
	logger("> running composer install in " + composerDir + "...", true, "info");
	run("composer install", { cwd: composerDir, stdio: "inherit" });
	logger("> composer install complete.", true, "success");

	// Ensure wp-env-bin-plugin is present — Composer may remove it on a fresh install
	// because the plugins/ directory is gitignored and managed by composer/installers.
	const pluginSrc = path.join(__dirname, "../scaffold/plugins/wp-env-bin-plugin");
	const pluginDest = path.join(composerDir, "plugins/wp-env-bin-plugin");
	fs.mkdirSync(path.join(pluginDest, "classes"), { recursive: true });
	for (const file of PLUGIN_FILES) {
		fs.copyFileSync(path.join(pluginSrc, file), path.join(pluginDest, file));
	}
	logger("> ensured wp-env-bin-plugin is present.", true, "success");
}

module.exports = { setup };
