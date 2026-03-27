const { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { logger } = require("../lib/utils/log");

/**
 * Parse CLI args for `wp-env-bin e2e generate editor|frontend`.
 *
 * @param {string[]} args - Raw argv slice (e.g. ["--file=block.json", "--output=dir"])
 * @param {"editor"|"frontend"} type
 * @returns {{ files: string[], output: string, glob: string|null, help: boolean, screenshots?: boolean, visualRegression?: boolean }}
 */
function parseGenerateArgs(args, type = 'editor') {
	const result = {
		files:  [],
		output: type === 'frontend'
			? './wp-env-bin/e2e/specs/frontend'
			: './wp-env-bin/e2e/specs/editor',
		glob:   null,
		help:   false,
	};

	if (type === 'frontend') {
		result.screenshots      = false;
		result.visualRegression = false;
	}

	for (const arg of args) {
		if (arg === '--help' || arg === '-h') {
			result.help = true;
		} else if (arg.startsWith('--file=')) {
			result.files.push(arg.slice('--file='.length));
		} else if (arg.startsWith('--output=')) {
			result.output = arg.slice('--output='.length);
		} else if (arg.startsWith('--glob=')) {
			result.glob = arg.slice('--glob='.length);
		} else if (type === 'frontend' && arg === '--screenshots') {
			result.screenshots = true;
		} else if (type === 'frontend' && arg === '--visual-regression') {
			result.visualRegression = true;
		} else {
			console.warn(`⚠️  Unknown argument ignored: ${arg}`);
		}
	}

	return result;
}
const { readE2eConfig, getConfigValue } = require("../lib/env/config");
const { requireDir } = require("../lib/env/check");

/**
 * Perform the file-system scaffolding for `wp-env-bin e2e scaffold`.
 * Separated from prompt logic so it can be called and tested independently.
 *
 * @param {string} dest    - Absolute path to the e2e destination directory
 * @param {string} scaffold - Absolute path to the scaffold source directory
 * @param {object} options
 * @param {string} options.projectType - "plugin" or "theme"
 * @param {string} options.slug        - Plugin or theme slug
 * @param {string} options.testTheme   - Theme slug to activate during tests (plugin only)
 * @param {string} options.wpVersion   - WordPress version string
 * @param {string} options.phpVersion  - PHP version string
 * @param {string} options.port        - wp-env development port (string)
 */
function scaffoldE2eFiles(dest, scaffold, {
	projectType,
	slug,
	testTheme,
	wpVersion,
	phpVersion,
	port,
	mysqlPort = 51606,
	testMysqlPort = 51607,
	wpConstants = {
		WP_DEBUG: false,
		WP_DEBUG_LOG: false,
		WP_DEBUG_DISPLAY: false,
		SCRIPT_DEBUG: false,
		DISABLE_WP_CRON: true,
	},
}) {
	const afterStart = projectType === "plugin"
		? `wp-env run cli wp plugin activate ${slug} && wp-env run cli wp theme activate ${testTheme}`
		: `wp-env run cli wp theme activate ${slug}`;

	// Create directories
	mkdirSync(path.join(dest, "specs/.auth"), { recursive: true });
	mkdirSync(path.join(dest, "specs/editor"), { recursive: true });
	mkdirSync(path.join(dest, "specs/frontend"), { recursive: true });
	mkdirSync(path.join(dest, "plugins"), { recursive: true });
	mkdirSync(path.join(dest, "themes"), { recursive: true });

	const devPort = parseInt(port, 10);
	const testPort = devPort + 1;

	const staticFiles = [
		{ src: "playwright.config.ts",               dest: "playwright.config.ts" },
		{ src: "tsconfig.json",                      dest: "tsconfig.json" },
		{ src: "tsconfig.e2e.json",                  dest: "tsconfig.e2e.json" },
		{ src: "gitignore",                          dest: ".gitignore" },
		{ src: "composer.json.example",              dest: "composer.json.example" },
		{ src: "wp-env-bin.e2e.config.json.example", dest: "wp-env-bin.e2e.config.json.example" },
		{ src: "specs/global.setup.ts",              dest: "specs/global.setup.ts" },
	];

	for (const file of staticFiles) {
		const destPath = path.join(dest, file.dest);
		if (!existsSync(destPath)) {
			copyFileSync(path.join(scaffold, file.src), destPath);
			logger("> created wp-env-bin/e2e/" + file.dest);
		} else {
			logger("> skipped wp-env-bin/e2e/" + file.dest + " (already exists)");
		}
	}

	// Create .auth/.gitkeep placeholder
	const authGitkeep = path.join(dest, "specs/.auth/.gitkeep");
	if (!existsSync(authGitkeep)) {
		writeFileSync(authGitkeep, "", "utf8");
	}

	// Generate .wp-env.json
	const wpEnvPath = path.join(dest, ".wp-env.json");
	if (!existsSync(wpEnvPath)) {
		const wpEnv = {
			$schema: "https://raw.githubusercontent.com/WordPress/gutenberg/refs/heads/trunk/schemas/json/wp-env.json",
			core: `WordPress/WordPress#${wpVersion}`,
			phpVersion,
			[projectType === "plugin" ? "plugins" : "themes"]: [".."],
			mappings: {
				"wp-content/themes": "./themes",
				"wp-content/plugins": "./plugins",
			},
			lifecycleScripts: { afterStart },
			config: wpConstants,
			env: {
				development: { port: devPort, mysqlPort },
				tests: { port: testPort, mysqlPort: testMysqlPort },
			},
		};
		writeFileSync(wpEnvPath, JSON.stringify(wpEnv, null, 4), "utf8");
		logger("> created wp-env-bin/e2e/.wp-env.json");
	} else {
		logger("> skipped wp-env-bin/e2e/.wp-env.json (already exists)");
	}

	// Generate .env
	const envPath = path.join(dest, ".env");
	if (!existsSync(envPath)) {
		writeFileSync(envPath, `WP_BASE_URL=http://localhost:${devPort}\n`, "utf8");
		logger("> created wp-env-bin/e2e/.env");
	} else {
		logger("> skipped wp-env-bin/e2e/.env (already exists)");
	}
}

/**
 * Return default values for the e2e init prompts by reading the existing
 * e2e config, wp-env-bin.config.json, and package.json. Used by the bin
 * to populate prompt defaults.
 *
 * @returns {{ projectType: string, pluginName: string, e2eConfig: object }}
 */
function getE2eDefaults() {
	const e2eConfig = readE2eConfig();

	const existingPluginName = getConfigValue("config.pluginName") ?? (() => {
		try { return JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")).name || ""; }
		catch { return ""; }
	})();
	const existingProjectType = getConfigValue("config.projectType") || "plugin";

	return { projectType: existingProjectType, pluginName: existingPluginName, e2eConfig };
}

/**
 * Scaffold an e2e/ test environment in the consuming project using the
 * supplied configuration values. All interactive decisions must be gathered
 * by the caller before invoking this function.
 *
 * @param {object} options
 * @param {string} options.projectType - "plugin" or "theme"
 * @param {string} options.slug        - Plugin or theme slug
 * @param {string} options.testTheme   - Theme to activate during tests (plugin projects only)
 * @param {string} options.wpVersion   - WordPress version string
 * @param {string} options.phpVersion  - PHP version string
 * @param {string} options.port        - wp-env development port for the e2e environment
 * @returns {void}
 */
function initE2e({ projectType, slug, testTheme, wpVersion, phpVersion, port }) {
	requireDir(path.join(process.cwd(), "wp-env-bin"), "Run this command from your project root (the directory containing wp-env-bin/).");
	const dest = path.join(process.cwd(), "wp-env-bin", "e2e");
	const scaffold = path.join(__dirname, "../scaffold/e2e");

	const e2eConfig = readE2eConfig();

	// ------------------------------------------------------------------
	// Build afterStart script and scaffold files
	// ------------------------------------------------------------------

	scaffoldE2eFiles(dest, scaffold, {
		projectType,
		slug,
		testTheme,
		wpVersion,
		phpVersion,
		port,
		mysqlPort: e2eConfig.mysqlPort,
		testMysqlPort: e2eConfig.testMysqlPort,
		wpConstants: e2eConfig.wpConstants,
	});

	// ------------------------------------------------------------------
	// Print next steps
	// ------------------------------------------------------------------

	const themeNote = projectType === "theme"
		? `\n  Note: if your test composer.json includes plugins, add them to afterStart in wp-env-bin/e2e/.wp-env.json:\n    "afterStart": "wp theme activate ${slug} && wp plugin activate plugin-one plugin-two"`
		: "";

	logger(`
E2e test environment scaffolded in wp-env-bin/e2e/
${themeNote}
Next steps:
  1. Install test dependencies (themes/plugins):
       cp wp-env-bin/e2e/composer.json.example wp-env-bin/e2e/composer.json
       # Edit wp-env-bin/e2e/composer.json to add your test theme/plugin dependencies
       cd wp-env-bin/e2e && composer install

  2. Configure block test targets:
       cp wp-env-bin/e2e/wp-env-bin.e2e.config.json.example wp-env-bin/e2e/wp-env-bin.e2e.config.json
       # Edit wp-env-bin/e2e/wp-env-bin.e2e.config.json to add block directories for testing

  3. Install Playwright browser:
       npx playwright install chromium

  4. Start the e2e environment (uses wp-env-bin/e2e/.wp-env.json, port ${parseInt(port, 10)}):
       cd wp-env-bin e2e env start
       # Your dev env on port 8889 can run at the same time

  5. Run tests:
       wp-env-bin e2e test
       wp-env-bin e2e test --project=all-blocks-editor
       wp-env-bin e2e test --project=all-blocks-frontend
       wp-env-bin e2e test --headed
`);
}

/**
 * Run Playwright tests from wp-env-bin/e2e/.
 *
 * Equivalent to: cd wp-env-bin/e2e && npx playwright test --config=playwright.config.ts
 * Any extra args are forwarded directly to Playwright (e.g. --project=, --headed, --debug).
 *
 * @param {string[]} args - Passthrough args to playwright test
 */
function runE2eTests(args = []) {
	const e2eDir = path.join(process.cwd(), "wp-env-bin", "e2e");
	requireDir(e2eDir, "Run `wp-env-bin e2e scaffold` first.");
	const result = spawnSync(
		"npx",
		["playwright", "test", "--config=playwright.config.ts", ...args],
		{
			stdio: "inherit",
			cwd: e2eDir,
		}
	);

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

/**
 * Generate Playwright block tests from a block.json file.
 *
 * @param {string}   type - "editor" or "frontend"
 * @param {string[]} args - CLI args: --file=, --glob=, --output=, --screenshots, etc.
 */
function generateE2eTests(type, args = []) {
	if (type !== "editor" && type !== "frontend") {
		console.log(`Unknown type "${type}". Use: wp-env-bin e2e generate editor|frontend --file=path/to/block.json`);
		process.exit(1);
	}

	const options   = parseGenerateArgs(args, type);
	const generator = type === "editor"
		? require("../lib/e2e/generate-block-tests")
		: require("../lib/e2e/generate-frontend-tests");

	generator.generate(options);
}

module.exports = { initE2e, getE2eDefaults, generateE2eTests, runE2eTests, scaffoldE2eFiles, parseGenerateArgs };
