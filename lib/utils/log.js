import chalk from 'chalk';

const styles = {
	success: chalk.green,
	error:   chalk.red,
	warn:    chalk.yellow,
	info:    chalk.cyan,
	muted:   chalk.gray,
};

/**
 * Log a message to stdout, or return it as a string when log is false.
 *
 * @param {string} output - The message to log or return
 * @param {boolean} [log=true] - When true, writes to console.log; when false, returns the string
 * @param {string|null} [type=null] - Color type: 'success', 'error', 'warn', 'info', 'muted'
 * @returns {string|undefined}
 */
function logger(output, log = true, type = null) {
	const styled = type && styles[type] ? styles[type](output) : output;
	if (log) {
		console.log(styled);
	} else {
		return styled;
	}
}

export { logger };
