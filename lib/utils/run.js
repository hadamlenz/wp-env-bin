const path = require("path");
const { execSync } = require("child_process");

/**
 * Execute a shell command synchronously in the current working directory.
 *
 * @param {string} cmd - Shell command to run
 * @param {object} [opts] - Options passed to execSync
 * @returns {Buffer|string}
 */
function run(cmd, opts) {
	return execSync(cmd, { cwd: process.cwd(), ...opts });
}

/**
 * Run a WP-CLI command on a remote Pantheon environment via Terminus.
 * Wraps the command as `terminus wp <sitenv> -- <cmd>`.
 *
 * @param {string} sitenv - Pantheon site.environment (e.g. `mysite.live`)
 * @param {string} cmd - WP-CLI command to run (e.g. `db export -`)
 * @param {object} [opts] - Options passed to execSync
 * @returns {Buffer|string}
 */
function terminus_wp(sitenv, cmd, opts) {
	const terminus_cmd = "terminus wp " + sitenv + " -- " + cmd;
	return execSync(terminus_cmd, { cwd: process.cwd(), ...opts });
}

/**
 * Run a WP-CLI command inside the local wp-env Docker container via `npx wp-env run cli`.
 *
 * @param {string} cmd - WP-CLI command to run (e.g. `wp db import /path/to/file.sql`)
 * @param {object} [opts] - Options passed to execSync
 * @returns {Buffer|string}
 */
function wpcli(cmd, opts) {
	const wpcmd = "npx wp-env run cli -- wp --exec='ini_set(\"memory_limit\",\"512M\");' " + cmd.replace(/^wp\s+/, "");
	return execSync(wpcmd, { cwd: path.join(process.cwd(), "wp-env-bin"), stdio: "inherit", ...opts });
}

/**
 * Run an arbitrary command inside the local wp-env Docker cli container via `npx wp-env run cli`.
 * Unlike wpcli(), this does NOT prepend `wp` — use for shell commands like bash, cp, etc.
 *
 * @param {string} cmd - Command to run inside the container (e.g. `bash -c 'cp /src /dst'`)
 * @param {object} [opts] - Options passed to execSync
 * @returns {Buffer|string}
 */
function wpenvrun(cmd, opts) {
	const wpcmd = "npx wp-env run cli -- " + cmd;
	return execSync(wpcmd, { cwd: path.join(process.cwd(), "wp-env-bin"), stdio: "inherit", ...opts });
}

module.exports = { run, terminus_wp, wpcli, wpenvrun };
