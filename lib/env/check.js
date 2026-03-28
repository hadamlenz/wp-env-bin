import { readFileSync, existsSync, rmSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import chalk from "chalk";

/**
 * Check whether the exported database file exists at wp-env-bin/assets/database.sql.
 *
 * @returns {boolean}
 */
function checkDatabase() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/database.sql"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Check whether the prefix-renamed database file exists at wp-env-bin/assets/database.modified.sql.
 *
 * @returns {boolean}
 */
function checkModifiedDatabase() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/database.modified.sql"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Check whether the generated .htaccess file exists at wp-env-bin/assets/.htaccess.
 *
 * @returns {boolean}
 */
function checkHtaccess() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/.htaccess"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Check whether the wp-env Docker environment is currently running.
 * Runs `npx wp-env status` in wp-env-bin/ and checks the exit code.
 *
 * @returns {boolean}
 */
function isWpEnvRunning() {
	const result = spawnSync("npx", ["wp-env", "status"], {
		cwd: path.join(process.cwd(), "wp-env-bin"),
		stdio: "pipe",
	});
	return result.status === 0;
}

/**
 * Assert that a directory exists, printing a helpful error and exiting if not.
 *
 * @param {string} dirPath - Absolute path to the directory
 * @param {string} hint    - Actionable message shown after the error (e.g. "Run X first.")
 */
function requireDir(dirPath, hint) {
	if (!existsSync(dirPath)) {
		console.error(chalk.red("Directory not found: " + dirPath));
		if (hint) console.error(hint);
		process.exit(1);
	}
}

/**
 * Assert that a file exists, printing a helpful error and exiting if not.
 *
 * @param {string} filePath - Absolute path to the file
 * @param {string} hint     - Actionable message shown after the error (e.g. "Run X first.")
 */
function requireFile(filePath, hint) {
	if (!existsSync(filePath)) {
		console.error(chalk.red("File not found: " + filePath));
		if (hint) console.error(hint);
		process.exit(1);
	}
}

/**
 * Before composer install runs, clean up any stale copy of the project's own
 * plugin/theme from wp-env-bin/plugins/ or wp-env-bin/themes/. These are left
 * over from when the project was incorrectly added to a profile's composer.json.
 * Composer will fail trying to delete them itself; we do it first.
 *
 * Also warns if .wp-env.json is missing the ".." plugin/theme reference, which
 * is the WordPress-native way to load the dev version without a fixed composer entry.
 *
 * @param {string} composerDir - Absolute path to wp-env-bin/ directory
 */
function cleanStaleProjectDirs(composerDir) {
	const slug = path.basename(process.cwd());

	for (const subdir of ["plugins", "themes"]) {
		const stale = path.join(composerDir, subdir, slug);
		if (existsSync(stale)) {
			console.log(chalk.yellow(
				`> Removing stale ${subdir}/${slug}/ — this project should be loaded via ".." in .wp-env.json, not via composer.`
			));
			try {
				rmSync(stale, { recursive: true, force: true });
			} catch (err) {
				if (err.code === "EACCES") {
					console.error(chalk.red(
						`> Permission denied removing ${stale}\n` +
						`  Docker likely owns this directory. Remove it manually:\n` +
						`  sudo rm -rf "${stale}"\n` +
						`  Then re-run: wp-env-bin composer install --delete-lock`
					));
					process.exit(1);
				}
				throw err;
			}
		}
	}

	const wpEnvPath = path.join(composerDir, ".wp-env.json");
	if (existsSync(wpEnvPath)) {
		try {
			const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
			const plugins = wpEnv.plugins || [];
			const themes = wpEnv.themes || [];
			const hasDotDot = [...plugins, ...themes].includes("..");
			if (!hasDotDot) {
				console.log(chalk.yellow(
					`> Warning: ".." is not listed in plugins or themes in wp-env-bin/.wp-env.json.\n` +
					`  Add it so wp-env loads this project's dev version directly (e.g. "plugins": [".."])`
				));
			}
		} catch {
			// malformed .wp-env.json — skip silently
		}
	}
}

export { checkDatabase, checkModifiedDatabase, checkHtaccess, isWpEnvRunning, requireDir, requireFile, cleanStaleProjectDirs };
