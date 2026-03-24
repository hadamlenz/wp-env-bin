const { readFileSync } = require("fs");
const path = require("path");

/**
 * Read and validate wp-env-bin/wp-env-bin.config.json from the current working directory.
 * Throws with a helpful message if the file is missing or required fields are absent.
 *
 * @returns {{ siteType: string, url: string, env?: string, oldPrefix?: string, siteId?: string, pluginName?: string }}
 */
function readLocalConfig() {
	let config;
	try {
		config = JSON.parse(
			readFileSync(path.join(process.cwd(), "wp-env-bin/wp-env-bin.config.json"), "utf8")
		);
	} catch {
		throw new Error(
			"wp-env-bin/wp-env-bin.config.json not found. Copy wp-env-bin.config.json.example to wp-env-bin/wp-env-bin.config.json and fill in your values."
		);
	}
	const siteType = config.siteType || "singlesite";
	const required = siteType === "multisite"
		? ["url", "oldPrefix", "siteId"]
		: ["url"];
	const missing = required.filter((k) => !config[k]);
	if (missing.length) {
		throw new Error(
			"wp-env-bin/wp-env-bin.config.json is missing required fields: " +
				missing.join(", ") +
				". See wp-env-bin.config.json.example."
		);
	}
	return config;
}

/**
 * Read the wp-env JSON config from the first file found among:
 * wp-env-bin/.wp-env.json, wp-env-bin/.wp-env.override.json, .wp-env.json
 * Throws if none are found.
 *
 * @returns {object} Parsed wp-env config object
 */
function readWpEnvJson() {
	const candidates = [
		"wp-env-bin/.wp-env.json",
		"wp-env-bin/.wp-env.override.json",
		".wp-env.json",
	];
	for (const candidate of candidates) {
		try {
			return JSON.parse(readFileSync(path.join(process.cwd(), candidate), "utf8"));
		} catch {
			// try next
		}
	}
	throw new Error("No wp-env config file found.");
}

/**
 * Read and merge wp-env-bin/e2e/wp-env-bin.e2e.config.json from the current working directory
 * with sensible defaults. Returns defaults silently if the file is absent.
 *
 * @returns {{ editor: string[], frontend: string[], wpVersion: string, phpVersion: string, testTheme: string, port: string, mysqlPort: number, testMysqlPort: number, wpConstants: object }}
 */
function readE2eConfig() {
	const defaults = {
		editor: [],
		frontend: [],
		wpVersion: "6.9.4",
		phpVersion: "8.3",
		testTheme: "twentytwentyfive",
		port: "8886",
		mysqlPort: 51606,
		testMysqlPort: 51607,
		wpConstants: {
			WP_DEBUG: false,
			WP_DEBUG_LOG: false,
			WP_DEBUG_DISPLAY: false,
			SCRIPT_DEBUG: false,
			DISABLE_WP_CRON: true,
		},
	};
	try {
		const parsed = JSON.parse(
			readFileSync(path.join(process.cwd(), "wp-env-bin/e2e/wp-env-bin.e2e.config.json"), "utf8")
		);
		return Object.assign({}, defaults, parsed);
	} catch {
		return defaults;
	}
}

const CONTAINER_ASSETS_PATH = "/var/www/html/wp-content/wp-env-bin";

module.exports = { readLocalConfig, readWpEnvJson, readE2eConfig, CONTAINER_ASSETS_PATH };
