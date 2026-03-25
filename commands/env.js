const path = require("path");
const { spawnSync } = require("child_process");

/**
 * Pass any wp-env command to the dev environment (wp-env-bin/).
 * Equivalent to: cd wp-env-bin && npx wp-env <args>
 *
 * @param {string[]} args - wp-env command and any flags, e.g. ["start", "--update"]
 */
function runWpEnv(args) {
	const cwd = path.join(process.cwd(), "wp-env-bin");
	const result = spawnSync("npx", ["wp-env", ...args], {
		stdio: "inherit",
		cwd,
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

/**
 * Pass any wp-env command to the e2e environment (wp-env-bin/e2e/).
 * Equivalent to: cd wp-env-bin/e2e && npx wp-env <args>
 *
 * @param {string[]} args - wp-env command and any flags, e.g. ["start", "--update"]
 */
function runWpEnvE2e(args) {
	const cwd = path.join(process.cwd(), "wp-env-bin", "e2e");
	const result = spawnSync("npx", ["wp-env", ...args], {
		stdio: "inherit",
		cwd,
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

module.exports = { runWpEnv, runWpEnvE2e };
