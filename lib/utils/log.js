/**
 * Log a message to stdout, or return it as a string when log is false.
 *
 * @param {string} output - The message to log or return
 * @param {boolean} [log=true] - When true, writes to console.log; when false, returns the string
 * @returns {string|undefined}
 */
function logger(output, log = true) {
	if (log) {
		console.log(output);
	} else {
		return output;
	}
}

module.exports = { logger };
