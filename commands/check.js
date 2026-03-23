const { readFileSync } = require("fs");
const path = require("path");

/**
 * Check whether the exported database file exists at wp-env-bin/assets/database.sql.
 *
 * @returns {boolean}
 */
function checkDatabase() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/database.sql"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Check whether the prefix-renamed database file exists at wp-env-bin/assets/database.modified.sql.
 *
 * @returns {boolean}
 */
function checkModifiedDatabase() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/database.modified.sql"));
		return true;
	} catch {
		return false;
	}
}

/**
 * Check whether the generated .htaccess file exists at wp-env-bin/assets/.htaccess.
 *
 * @returns {boolean}
 */
function checkHtaccess() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/.htaccess"));
		return true;
	} catch {
		return false;
	}
}

module.exports = { checkDatabase, checkModifiedDatabase, checkHtaccess };
