const { writeFileSync, statSync, rmSync } = require("fs");
const path = require("path");
const htaccessTemplate = require("../templates/htaccess.tpl");
const { logger } = require("../lib/utils/log");
const { wpcli } = require("../lib/utils/run");
const { readLocalConfig } = require("../lib/env/config");
const { checkHtaccess } = require("../lib/env/check");

/**
 * Remove a path if it is a directory rather than a file.
 * Docker creates empty directories as placeholders when a mapped file doesn't exist yet;
 * this clears those so the file can be written in its place.
 *
 * @param {string} filePath - Absolute path to check and potentially remove
 */
function clearIfDirectory(filePath) {
	try {
		const stat = statSync(filePath);
		if (stat.isDirectory()) {
			logger("> removing directory at " + filePath + " (created by Docker when file was missing)");
			rmSync(filePath, { recursive: true });
		}
	} catch {
		// path doesn't exist yet, nothing to clear
	}
}

/**
 * Generate the .htaccess file for the local environment and write it to
 * wp-env-bin/assets/.htaccess. The file sets up a reverse proxy that redirects
 * media upload requests to the live site so assets load without a full download.
 * Prompts to reuse an existing file if one is present, then attempts to copy
 * the file into the running Docker container immediately.
 *
 * @returns {Promise<void>}
 */
async function makeHtaccess() {
	const config = readLocalConfig();
	const { url, siteId, containerAssetsPath, siteType } = config;
	const resolvedSiteType = siteType || "singlesite";

	if (!url) {
		throw new Error("wp-env-bin.config.json must have 'url' set.");
	}
	if (resolvedSiteType === "multisite" && !siteId) {
		throw new Error("wp-env-bin.config.json must have 'siteId' set for multisite.");
	}

	if (checkHtaccess()) {
		const { select } = await import("@inquirer/prompts");
		const action = await select({
			message: "wp-env-bin/assets/.htaccess already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing .htaccess", value: "useIt" },
				{ name: "Regenerate from current config", value: "regenerate" },
			],
		});
		if (action === "useIt") {
			logger("> using existing wp-env-bin/assets/.htaccess");
			return;
		}
	}

	const content = htaccessTemplate(url, siteId, resolvedSiteType);
	const outPath = path.join(process.cwd(), "wp-env-bin/assets/.htaccess");

	clearIfDirectory(outPath);
	writeFileSync(outPath, content, "utf8");
	logger("> .htaccess written to wp-env-bin/assets/.htaccess");
	if (resolvedSiteType === "multisite") {
		logger("> media proxy: /wp-content/uploads/* → https://" + url + "/wp-content/uploads/sites/" + siteId + "/");
	} else {
		logger("> media proxy: /wp-content/uploads/* → https://" + url + "/wp-content/uploads/");
	}

	try {
		wpcli("bash -c 'cp " + containerAssetsPath + "/.htaccess /var/www/html/.htaccess'");
		logger("> htaccess applied to running container.");
	} catch {
		logger("> note: run `npx wp-env start` to apply htaccess to the container.");
	}
}

module.exports = { makeHtaccess };
