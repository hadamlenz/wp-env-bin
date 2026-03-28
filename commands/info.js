import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from "chalk";
import { readRawConfig } from "../lib/env/config.js";

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);

// Maps each user-facing source name to its relative file path (from project root)
// and an optional schema path (relative to this package's root, resolved via __dirname).
// schema: null means the source is displayed without JSON Schema validation.
const SOURCES = {
	"config":       { file: "wp-env-bin/wp-env-bin.config.json",         schema: "schemas/wp-env-bin.config.schema.json" },
	"composer":     { file: "wp-env-bin/composer.json",                  schema: null },
	"e2e config":   { file: "wp-env-bin/e2e/wp-env-bin.e2e.config.json", schema: "schemas/wp-env-bin.e2e.config.schema.json" },
	"e2e composer": { file: "wp-env-bin/e2e/composer.json",              schema: null },
};


/**
 * Validate a parsed config object against its JSON Schema, if one is defined for the source.
 * Uses ajv with strict mode and format validation disabled to avoid false positives
 * from formats (e.g. "email") that are defined in the schema but not registered in ajv.
 *
 * @param {string} source - A key from SOURCES
 * @param {object} data   - The parsed config object to validate
 * @returns {string[]|null} Array of human-readable error strings, or null if valid / no schema
 */
function validateSource(source, data) {
	const schemaRelPath = SOURCES[source].schema;
	if (!schemaRelPath) return null;
	const schemaAbs = path.join(__dirname, "..", schemaRelPath);
	if (!existsSync(schemaAbs)) return null;
	try {
		const Ajv = require("ajv");
		const ajv = new Ajv({ strict: false, validateFormats: false });
		const schema = JSON.parse(readFileSync(schemaAbs, "utf8"));
		const valid = ajv.validate(schema, data);
		if (valid) return null;
		return ajv.errors.map(e => (e.instancePath ? e.instancePath + " " : "") + e.message);
	} catch {
		return null;
	}
}

/**
 * Format a config value for terminal output.
 * Objects and arrays are pretty-printed as indented JSON; primitives are cast to string.
 *
 * @param {*} v
 * @returns {string}
 */
function printValue(v) {
	return typeof v === "object" && v !== null ? JSON.stringify(v, null, 2) : String(v);
}

/**
 * Entry point for `wp-env-bin info [source] [key]`.
 *
 * Three output levels:
 *   - No args:        list all four sources with their file paths, flagging missing files
 *   - Source only:    print the absolute file path, all key-value pairs, and any schema errors
 *   - Source + key:   print just the value for that key (exits 1 if key not found)
 *
 * Source names with two tokens ("e2e config", "e2e composer") are detected by checking
 * argv[0] === "e2e" before falling through to single-token source parsing.
 *
 * @param {string[]} argv - Trailing arguments: process.argv.slice(3)
 */
function infoCommand(argv) {
	// Parse source and key from argv
	let source, key;
	if (argv[0] === "e2e" && (argv[1] === "config" || argv[1] === "composer")) {
		source = "e2e " + argv[1];
		key = argv[2];
	} else {
		source = argv[0];
		key = argv[1];
	}

	// Level 1: list all sources
	if (!source) {
		const nameWidth = "e2e composer".length;
		for (const [name, { file }] of Object.entries(SOURCES)) {
			const exists = existsSync(path.join(process.cwd(), file));
			console.log(
				chalk.bold(name.padEnd(nameWidth + 2)) +
				chalk.gray(file) +
				(exists ? "" : chalk.red("  (not found)"))
			);
		}
		return;
	}

	// Unknown source
	if (!SOURCES[source]) {
		console.log(chalk.red(`Unknown source: "${source}". Available: ${Object.keys(SOURCES).join(", ")}`));
		process.exit(1);
	}

	// SOURCES uses space-separated display keys ("e2e config"); RAW_SOURCES uses dots ("e2e.config")
	const data = readRawConfig(source.replace(" ", "."));
	const absFile = path.join(process.cwd(), SOURCES[source].file);

	if (!data) {
		console.log(chalk.red(`${SOURCES[source].file} not found or unreadable.`));
		process.exit(1);
	}

	// Level 3/4: single key
	if (key) {
		if (!(key in data)) {
			console.log(chalk.red(`Key "${key}" not found in ${SOURCES[source].file}.`));
			process.exit(1);
		}
		console.log(printValue(data[key]));
		return;
	}

	// Level 2: show file path + all key-value pairs + optional validation
	console.log(chalk.bold("File: ") + absFile);
	console.log();
	for (const [k, v] of Object.entries(data)) {
		console.log(chalk.cyan(k) + ": " + printValue(v));
	}

	const errors = validateSource(source, data);
	if (errors && errors.length) {
		console.log();
		console.log(chalk.yellow("⚠ Validation errors:"));
		for (const err of errors) {
			console.log(chalk.yellow("  - " + err));
		}
	}
}

export { infoCommand };
