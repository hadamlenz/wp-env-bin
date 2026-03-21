const { openSync, readSync, closeSync, copyFileSync, statSync } = require("fs");
const path = require("path");
const { logger } = require("./log");
const { checkDatabase } = require("./check");

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

module.exports = { validateSqlFile, useDb };
