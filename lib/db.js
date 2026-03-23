const { openSync, readSync, closeSync, statSync } = require("fs");

/**
 * Replace all occurrences of a table prefix in a SQL string with `wp_`.
 * Special regex characters in the prefix are escaped before matching.
 *
 * @param {string} content - Raw SQL string
 * @param {string} oldPrefix - The existing table prefix to replace (e.g. `wpsites_7_`)
 * @returns {{ modified: string, count: number }} Modified SQL and number of replacements made
 */
function renamePrefix(content, oldPrefix) {
	const escaped = oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const count = (content.match(new RegExp(escaped, "g")) || []).length;
	const modified = content.split(oldPrefix).join("wp_");
	return { modified, count };
}

/**
 * Validate that a file is a suitable WordPress mysqldump export.
 * Checks file extension, existence, non-empty size, mysqldump header,
 * presence of a CREATE TABLE statement, and a WordPress _options table.
 * Throws a descriptive Error if any check fails.
 *
 * @param {string} filePath - Absolute path to the SQL file
 */
function validateSqlFile(filePath) {
	if (!filePath.toLowerCase().endsWith(".sql")) {
		throw new Error("File must have a .sql extension.");
	}

	let stat;
	try {
		stat = statSync(filePath);
	} catch {
		throw new Error("File not found: " + filePath);
	}
	if (stat.size === 0) {
		throw new Error("File is empty: " + filePath);
	}

	const fd = openSync(filePath, "r");
	const buf = Buffer.alloc(4096);
	readSync(fd, buf, 0, 4096, 0);
	closeSync(fd);
	const head = buf.toString("utf8");

	if (!head.includes("-- MySQL dump") && !head.includes("-- MariaDB dump")) {
		throw new Error(
			"File does not appear to be a mysqldump export.\n" +
			"Export your database with: wp db export database.sql\n" +
			"The file must begin with a mysqldump header (-- MySQL dump or -- MariaDB dump)."
		);
	}

	if (!head.includes("CREATE TABLE")) {
		throw new Error(
			"File does not contain a CREATE TABLE statement. " +
			"Ensure you are exporting with schema included (the default for wp db export)."
		);
	}

	if (!head.includes("_options")) {
		throw new Error(
			"File does not appear to be a WordPress database export — " +
			"no options table found in the first portion of the file."
		);
	}
}

module.exports = { renamePrefix, validateSqlFile };
