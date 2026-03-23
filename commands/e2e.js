const { mkdirSync, existsSync, copyFileSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { logger } = require("./log");

/**
 * Scaffold an e2e/ test environment in the consuming project.
 *
 * Creates an isolated wp-env configuration with separate ports so the
 * test environment can coexist with the development environment. Copies
 * Playwright config, TypeScript configs, and shared helpers. Generator
 * scripts remain bundled in wp-env-bin and are invoked via the CLI.
 *
 * @returns {Promise<void>}
 */
async function initE2e() {
	const dest = path.join(process.cwd(), "e2e");
	const scaffold = path.join(__dirname, "../scaffold/e2e");

	const { confirm, input } = await import("@inquirer/prompts");

	// ------------------------------------------------------------------
	// Prompt for configuration
	// ------------------------------------------------------------------

	const wpVersion = await input({
		message: "WordPress version",
		default: "6.9.4",
	});

	const phpVersion = await input({
		message: "PHP version",
		default: "8.3",
	});

	const afterStart = await input({
		message: "afterStart lifecycle script (e.g. wp theme activate my-theme && wp plugin activate my-plugin)",
		default: "",
	});

	const port = await input({
		message: "wp-env development port for e2e environment (must differ from your dev env, default 8889)",
		default: "8886",
	});

	// ------------------------------------------------------------------
	// Create directories
	// ------------------------------------------------------------------

	mkdirSync(path.join(dest, "specs/.auth"), { recursive: true });
	mkdirSync(path.join(dest, "specs/editor"), { recursive: true });
	mkdirSync(path.join(dest, "specs/frontend"), { recursive: true });
	mkdirSync(path.join(dest, "plugins"), { recursive: true });
	mkdirSync(path.join(dest, "themes"), { recursive: true });

	// ------------------------------------------------------------------
	// Copy static scaffold files (skip if already exist)
	// ------------------------------------------------------------------

	const devPort = parseInt(port, 10);
	const testPort = devPort + 1;
	const devMysqlPort = 51606;
	const testMysqlPort = 51607;

	const staticFiles = [
		{ src: "playwright.config.ts",       dest: "playwright.config.ts" },
		{ src: "tsconfig.json",              dest: "tsconfig.json" },
		{ src: "tsconfig.e2e.json",          dest: "tsconfig.e2e.json" },
		{ src: "gitignore",                  dest: ".gitignore" },
		{ src: "composer.json.example",      dest: "composer.json.example" },
		{ src: "specs/global.setup.ts",      dest: "specs/global.setup.ts" },
	];

	for (const file of staticFiles) {
		const destPath = path.join(dest, file.dest);
		if (!existsSync(destPath)) {
			copyFileSync(path.join(scaffold, file.src), destPath);
			logger("> created e2e/" + file.dest);
		} else {
			logger("> skipped e2e/" + file.dest + " (already exists)");
		}
	}

	// Create .auth/.gitkeep placeholder so the directory is tracked
	const authGitkeep = path.join(dest, "specs/.auth/.gitkeep");
	if (!existsSync(authGitkeep)) {
		writeFileSync(authGitkeep, "", "utf8");
	}

	// ------------------------------------------------------------------
	// Generate .wp-env.json with user-supplied values
	// ------------------------------------------------------------------

	const wpEnvPath = path.join(dest, ".wp-env.json");
	if (!existsSync(wpEnvPath)) {
		const wpEnv = {
			$schema: "https://raw.githubusercontent.com/WordPress/gutenberg/refs/heads/trunk/schemas/json/wp-env.json",
			core: `WordPress/WordPress#${wpVersion}`,
			phpVersion,
			plugins: [".."],
			mappings: {
				"wp-content/themes": "./themes",
				"wp-content/plugins": "./plugins",
			},
			lifecycleScripts: {
				afterStart: afterStart || undefined,
			},
			config: {
				WP_DEBUG: false,
				WP_DEBUG_LOG: false,
				WP_DEBUG_DISPLAY: false,
				SCRIPT_DEBUG: false,
				DISABLE_WP_CRON: true,
			},
			env: {
				development: { port: devPort, mysqlPort: devMysqlPort },
				tests: { port: testPort, mysqlPort: testMysqlPort },
			},
		};

		// Remove afterStart key if blank
		if (!wpEnv.lifecycleScripts.afterStart) {
			delete wpEnv.lifecycleScripts;
		}

		writeFileSync(wpEnvPath, JSON.stringify(wpEnv, null, 4), "utf8");
		logger("> created e2e/.wp-env.json");
	} else {
		logger("> skipped e2e/.wp-env.json (already exists)");
	}

	// ------------------------------------------------------------------
	// Print next steps
	// ------------------------------------------------------------------

	logger(`
E2e test environment scaffolded in e2e/

Next steps:
  1. Install test dependencies (themes/plugins):
       cp e2e/composer.json.example e2e/composer.json
       # Edit e2e/composer.json to add your test theme/plugin dependencies
       cd e2e && composer install

  2. Install Playwright browser:
       npx playwright install chromium

  3. Start the e2e environment (uses e2e/.wp-env.json, port ${devPort}):
       cd e2e && npx wp-env start
       # Your dev env on port 8889 can run at the same time

  4. Generate block tests from block.json:
       wp-env-bin e2e generate editor --file=src/blocks/my-block/block.json
       wp-env-bin e2e generate frontend --file=src/blocks/my-block/block.json

  5. Run tests:
       npx playwright test --config=e2e/playwright.config.ts

Add these scripts to your project package.json:
  "e2e:env:start":         "cd e2e && npx wp-env start",
  "e2e:env:stop":          "cd e2e && npx wp-env stop",
  "test:e2e":              "playwright test --config=e2e/playwright.config.ts --quiet",
  "test:e2e:editor":       "playwright test --config=e2e/playwright.config.ts --project=all-blocks-editor --quiet",
  "test:e2e:frontend":     "playwright test --config=e2e/playwright.config.ts --project=all-blocks-frontend --quiet",
  "test:e2e:report":       "playwright show-report e2e/playwright-report",
  "e2e:generate:editor":   "wp-env-bin e2e generate editor",
  "e2e:generate:frontend": "wp-env-bin e2e generate frontend"

Required devDependencies (npm install --save-dev):
  @wordpress/e2e-test-utils-playwright
  @playwright/test
  @axe-core/playwright
  typescript
  source-map-support
`);
}

/**
 * Generate Playwright block tests from a block.json file.
 *
 * Runs the generate-block-tests.js or generate-frontend-tests.js script
 * bundled with wp-env-bin. Must be run from the project root.
 *
 * @param {string}   type - "editor" or "frontend"
 * @param {string[]} args - Passthrough args: --file=, --glob=, --output=, --screenshots, etc.
 */
function generateE2eTests(type, args = []) {
	if (type !== "editor" && type !== "frontend") {
		console.log(`Unknown type "${type}". Use: wp-env-bin e2e generate editor|frontend --file=path/to/block.json`);
		process.exit(1);
	}

	const scriptPath = type === "editor"
		? path.join(__dirname, "../lib/e2e/generate-block-tests.js")
		: path.join(__dirname, "../lib/e2e/generate-frontend-tests.js");

	const result = spawnSync(process.execPath, [scriptPath, ...args], {
		stdio: "inherit",
		cwd: process.cwd(),
	});

	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

module.exports = { initE2e, generateE2eTests };
