const path = require("path");
const fs = require("fs");
const { run } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");

/**
 * Run `composer install` inside the wp-env-bin/ directory to install
 * the PHP plugin and theme dependencies declared in composer.json.
 *
 * @param {string[]} argv - CLI args (supports --delete-lock)
 */
function setup(argv = []) {
	const composerDir = path.join(process.cwd(), "wp-env-bin");

	if (argv.includes("--delete-lock")) {
		const lockFile = path.join(composerDir, "composer.lock");
		if (fs.existsSync(lockFile)) {
			fs.unlinkSync(lockFile);
			logger("> deleted composer.lock");
		} else {
			logger("> composer.lock not found, skipping delete");
		}
	}

	logger("> running composer install in " + composerDir + "...");
	run("composer install", { cwd: composerDir, stdio: "inherit" });
	logger("> composer install complete.");
}

module.exports = { setup };
