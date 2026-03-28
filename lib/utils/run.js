import path from "path";
import { execSync } from "child_process";

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
 * Build the full shell command string for a remote WP-CLI call based on the host type.
 * The `config.env` field holds the host-specific connection identifier:
 *   - pantheon → "site.environment" (e.g. "mysite.live")
 *   - wpvip    → "app.environment"  (e.g. "myapp.production")
 *   - ssh      → WP-CLI SSH string  (e.g. "user@hostname/var/www/html")
 *
 * @param {object} config - Parsed wp-env-bin.config.json
 * @param {string} cmd    - WP-CLI command string (e.g. "db export -")
 * @returns {string} The full shell command to execute
 */
function buildRemoteCmd(config, cmd) {
	const host = config.host || "pantheon";

	switch (host) {
		case "pantheon":
			return "terminus wp " + config.env + " -- " + cmd;

		case "ssh":
			return "wp --ssh=" + config.env + " " + cmd;

		case "wpvip":
			return "vip wp " + config.env + " -- " + cmd;

		default:
			throw new Error("Unknown host type in wp-env-bin.config.json: " + host);
	}
}

/**
 * Run a WP-CLI command on a remote server using the host type from config.
 * Dispatches to terminus (Pantheon), wp --ssh= (generic SSH), or vip (WPVIP).
 *
 * @param {object} config - Parsed wp-env-bin.config.json
 * @param {string} cmd    - WP-CLI command string (e.g. "db export -")
 * @param {object} [opts] - Options passed to execSync
 * @returns {Buffer|string}
 */
function remote_wp(config, cmd, opts) {
	return execSync(buildRemoteCmd(config, cmd), { cwd: process.cwd(), ...opts });
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

export { run, terminus_wp, buildRemoteCmd, remote_wp, wpcli, wpenvrun };
