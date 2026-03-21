const { writeFileSync, statSync, rmSync } = require("fs");
const path = require("path");
const htaccessTemplate = require("../templates/htaccess.tpl");
const { logger } = require("./log");
const { wpcli } = require("./run");
const { readLocalConfig } = require("./get");
const { checkHtaccess } = require("./check");

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

async function makeHtaccess() {
	const config = readLocalConfig();
	const { url, siteId, containerAssetsPath, siteType } = config;
	const resolvedSiteType = siteType || "singlesite";

	if (!url) {
		throw new Error("wp-env.config.json must have 'url' set.");
	}
	if (resolvedSiteType === "multisite" && !siteId) {
		throw new Error("wp-env.config.json must have 'siteId' set for multisite.");
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
		logger("> note: run `npm run wp-env start` to apply htaccess to the container.");
	}
}

module.exports = { makeHtaccess };
