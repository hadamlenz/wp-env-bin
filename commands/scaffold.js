import { mkdirSync, existsSync, copyFileSync } from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { logger } from "../lib/utils/log.js";

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Copy template files from the package's scaffold/ directory into the
 * consuming project's wp-env-bin/ folder. Files that already exist are
 * skipped — this function is safe to re-run on an existing project.
 *
 * @param {string} dest - Absolute path to the consuming project's wp-env-bin/ folder
 * @returns {{ file: string, created: boolean }[]} One entry per template file
 */
function scaffoldFiles(dest) {
	const scaffold = path.join(__dirname, "../scaffold");
	const results = [];

	mkdirSync(path.join(dest, "assets"), { recursive: true });
	mkdirSync(path.join(dest, "logs"), { recursive: true });
	mkdirSync(path.join(dest, "plugins/wp-env-bin-plugin/classes"), { recursive: true });

	// Scaffold dotfiles are stored without a leading dot so npm includes them
	// in the published package. They are copied here with their correct names.
	const files = [
		{ src: "wp-env.json",        dest: ".wp-env.json" },
		{ src: "gitignore",          dest: ".gitignore" },
		{ src: "assets/gitkeep",     dest: "assets/.gitkeep" },
		{ src: "plugins/wp-env-bin-plugin/wp-env-bin-plugin.php",         dest: "plugins/wp-env-bin-plugin/wp-env-bin-plugin.php" },
		{ src: "plugins/wp-env-bin-plugin/classes/class-service-worker.php", dest: "plugins/wp-env-bin-plugin/classes/class-service-worker.php" },
		{ src: "wp-env-bin.config.json.example", dest: "wp-env-bin.config.json.example" },
		{ src: "composer.json.example",      dest: "composer.json.example" },
	];

	for (const file of files) {
		const destPath = path.join(dest, file.dest);
		if (!existsSync(destPath)) {
			copyFileSync(path.join(scaffold, file.src), destPath);
			logger("> created wp-env-bin/" + file.dest, true, "success");
			results.push({ file: file.dest, created: true });
		} else {
			logger("> skipped wp-env-bin/" + file.dest + " (already exists)", true, "muted");
			results.push({ file: file.dest, created: false });
		}
	}

	return results;
}

/**
 * Copy template files into the consuming project's wp-env-bin/ folder.
 * Detects whether this is a new install or an existing project and logs
 * accordingly. Existing files are never overwritten.
 *
 * @param {string} dest - Absolute path to the consuming project's wp-env-bin/ folder
 * @returns {void}
 */
function scaffoldCommand(dest) {
	const isNewInstall = !existsSync(dest);

	if (isNewInstall) {
		logger("> New install detected — creating wp-env-bin/ folder structure...", true, "info");
	} else {
		logger("> Existing project detected — copying only missing files...", true, "info");
	}

	scaffoldFiles(dest);

	logger("\nScaffold complete.", true, "success");
	logger("  Next: run `wp-env-bin config create` to create a site config profile.");
}

export { scaffoldFiles, scaffoldCommand };
