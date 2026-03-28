import { existsSync, rmSync } from "fs";
import path from "path";
import chalk from "chalk";
import { logger } from "../lib/utils/log.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Delete a directory under wp-env-bin/ if it exists, log result.
 *
 * @param {string} wpEnvBinDir - Absolute path to wp-env-bin/
 * @param {string} subdir      - Subdirectory name, e.g. "themes"
 */
function cleanDir(wpEnvBinDir, subdir) {
	const target = path.join(wpEnvBinDir, subdir);
	if (existsSync(target)) {
		rmSync(target, { recursive: true, force: true });
		logger(`> deleted wp-env-bin/${subdir}/`, true, "success");
	} else {
		logger(`> wp-env-bin/${subdir}/ not found, skipping`, true, "muted");
	}
}

/**
 * Resolve and validate the wp-env-bin/ directory, exiting with an error if absent.
 *
 * @returns {string} Absolute path to wp-env-bin/
 */
function requireWpEnvBin() {
	const dir = path.join(process.cwd(), "wp-env-bin");
	if (!existsSync(dir)) {
		console.error(chalk.red("Directory not found: " + dir));
		console.error("Run this command from your project root (the directory containing wp-env-bin/).");
		process.exit(1);
	}
	return dir;
}

// ─── exports ──────────────────────────────────────────────────────────────────

/**
 * Delete wp-env-bin/themes/.
 */
function cleanThemes() {
	cleanDir(requireWpEnvBin(), "themes");
}

/**
 * Delete wp-env-bin/plugins/.
 */
function cleanPlugins() {
	cleanDir(requireWpEnvBin(), "plugins");
}

/**
 * Delete wp-env-bin/assets/.
 */
function cleanAssets() {
	cleanDir(requireWpEnvBin(), "assets");
}

/**
 * Delete wp-env-bin/themes/, plugins/, and assets/.
 */
function cleanAll() {
	const dir = requireWpEnvBin();
	cleanDir(dir, "themes");
	cleanDir(dir, "plugins");
	cleanDir(dir, "assets");
}

export { cleanThemes, cleanPlugins, cleanAssets, cleanAll };
