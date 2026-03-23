const { readFileSync } = require("fs");
const path = require("path");

/**
 * Read and validate wp-env-bin/wp-env-bin.config.json from the current working directory.
 * Throws with a helpful message if the file is missing or required fields are absent.
 *
 * @returns {{ siteType: string, url: string, env?: string, oldPrefix?: string, siteId?: string, pluginName?: string, containerAssetsPath?: string }}
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

module.exports = { readLocalConfig, readWpEnvJson };
