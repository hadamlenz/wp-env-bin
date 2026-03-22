const { execSync } = require("child_process");

function run(cmd, opts) {
	return execSync(cmd, { cwd: process.cwd(), ...opts });
}

function terminus_wp(sitenv, cmd, opts) {
	const terminus_cmd = "terminus wp " + sitenv + " -- " + cmd;
	return execSync(terminus_cmd, { cwd: process.cwd(), ...opts });
}

function wpcli(cmd, opts) {
	const wpcmd = "npm run --silent wp-env run cli -- " + cmd;
	return execSync(wpcmd, { cwd: process.cwd(), stdio: "inherit", ...opts });
}

module.exports = { run, terminus_wp, wpcli };
