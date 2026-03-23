const { copyFileSync } = require("fs");
const path = require("path");
const { logger } = require("../lib/utils/log");
const { checkDatabase } = require("../lib/env/check");
const { validateSqlFile } = require("../lib/db");

/**
 * Validate a local SQL file and copy it to wp-env-bin/assets/database.sql
 * for use as the local database source. Prompts before overwriting an existing file.
 *
 * @param {string} filePath - Path to the SQL file provided by the user
 * @returns {Promise<void>}
 */
async function useDb(filePath) {
	if (!filePath) {
		throw new Error("Please provide a path: wp-env-bin use db <path/to/file.sql>");
	}

	const resolved = path.resolve(filePath);
	logger("> validating " + resolved + "...");
	validateSqlFile(resolved);
	logger("> validation passed (mysqldump header and WordPress options table found)");

	const dest = path.join(process.cwd(), "wp-env-bin/assets/database.sql");

	if (checkDatabase()) {
		const { select } = await import("@inquirer/prompts");
		const action = await select({
			message: "wp-env-bin/assets/database.sql already exists. What would you like to do?",
			choices: [
				{ name: "Replace it with the new file", value: "replace" },
				{ name: "Keep the existing file", value: "keep" },
			],
		});
		if (action === "keep") {
			logger("> keeping existing wp-env-bin/assets/database.sql");
			return;
		}
	}

	copyFileSync(resolved, dest);
	logger("> copied to wp-env-bin/assets/database.sql");
	logger("> run 'wp-env-bin process db' to import it into the local environment");
}

module.exports = { useDb };
