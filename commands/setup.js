const path = require("path");
const { run } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");

/**
 * Run `composer install` inside the wp-env-bin/ directory to install
 * the PHP plugin and theme dependencies declared in composer.json.
 */
function setup() {
	const composerDir = path.join(process.cwd(), "wp-env-bin");
	logger("> running composer install in " + composerDir + "...");
	run("composer install", { cwd: composerDir, stdio: "inherit" });
	logger("> composer install complete.");
}

module.exports = { setup };
