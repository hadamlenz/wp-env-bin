const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

/** Absolute path to the WordPress debug log on the host filesystem. */
const LOG_PATH = path.join(process.cwd(), "wp-env-bin/logs/debug.log");

/**
 * Tail the WordPress debug log file in real time.
 * Requires the logs/ directory to be mounted via .wp-env.json mappings
 * and WP_DEBUG_LOG set to "/var/www/html/wp-content/logs/debug.log".
 */
function logsCommand() {
	if (!fs.existsSync(LOG_PATH)) {
		console.log(
			"Log file not found: " + LOG_PATH + "\n" +
			"Make sure wp-env is running and your .wp-env.json includes:\n" +
			'  mappings: { "wp-content/logs": "./logs" }\n' +
			'  config:   { "WP_DEBUG_LOG": "/var/www/html/wp-content/logs/debug.log" }'
		);
		process.exit(1);
	}
	spawnSync("tail", ["-f", LOG_PATH], { stdio: "inherit" });
}

/**
 * Truncate the WordPress debug log file.
 */
function logsClearCommand() {
	if (!fs.existsSync(LOG_PATH)) {
		console.log("Log file not found: " + LOG_PATH);
		process.exit(1);
	}
	fs.writeFileSync(LOG_PATH, "");
	console.log("Log cleared.");
}

module.exports = { logsCommand, logsClearCommand, LOG_PATH };
