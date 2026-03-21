const path = require("path");
const { run } = require("./run");
const { logger } = require("./log");

function setup() {
	const composerDir = path.join(process.cwd(), "wp-env-bin");
	logger("> running composer install in " + composerDir + "...");
	run("composer install", { cwd: composerDir, stdio: "inherit" });
	logger("> composer install complete.");
}

module.exports = { setup };
