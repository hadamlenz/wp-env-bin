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

/**
 * Print env-specific usage for the dev environment.
 */
function envHelp() {
	console.log(`
wp-env-bin env — Pass wp-env commands to the dev environment (wp-env-bin/)

Usage:
  wp-env-bin env <command> [args]

Any <command> and [args] are forwarded directly to npx wp-env.

Common commands:
  start                   Start the environment
  stop                    Stop the environment
  destroy                 Remove the environment (deletes volumes)
  logs                    Stream environment logs
  run <container> <cmd>   Run a command inside the environment

Examples:
  wp-env-bin env start
  wp-env-bin env stop
  wp-env-bin env start --update
  wp-env-bin env run tests "wp --info"

See also:
  wp-env-bin e2e env    Manage the e2e test environment
`);
}

/**
 * Print env-specific usage for the e2e environment.
 */
function e2eEnvHelp() {
	console.log(`
wp-env-bin e2e env — Pass wp-env commands to the e2e environment (wp-env-bin/e2e/)

Usage:
  wp-env-bin e2e env <command> [args]

Any <command> and [args] are forwarded directly to npx wp-env.

Common commands:
  start                   Start the environment
  stop                    Stop the environment
  destroy                 Remove the environment (deletes volumes)
  logs                    Stream environment logs
  run <container> <cmd>   Run a command inside the environment

Examples:
  wp-env-bin e2e env start
  wp-env-bin e2e env stop
  wp-env-bin e2e env destroy
  wp-env-bin e2e env start --update

See also:
  wp-env-bin env    Manage the dev environment
`);
}

module.exports = { runWpEnv, runWpEnvE2e, envHelp, e2eEnvHelp };
