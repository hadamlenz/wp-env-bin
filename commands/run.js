const { execSync } = require("child_process");
// const util = require('util');
// const execSync = util.promisify(require('child_process').execSync);

function run(cmd, opts) {
	return execSync(cmd, { ...opts });
}

function npmRun(cmd, opts) {
	let npm_cmd = "npm run " + cmd;
	return execSync(npm_cmd, { ...opts });
}

/**
 * for running pantheon specific terminus commands
 */
function terminus_wp(sitenv, cmd, opts) {
	let terminus_cmd = "terminus wp " + sitenv + " -- " + cmd;
	//logger(terminus_cmd);
	return execSync(terminus_cmd, { ...opts });
}

function wpcli(cmd, opts) {
	let wpcmd = "npm run wp-env run cli " + cmd;
	//logger(wpcmd);
	return execSync(wpcmd, { ...opts });
}

module.exports = {
	run,
	npmRun,
	terminus_wp,
	wpcli,
};
