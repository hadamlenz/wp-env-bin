const { readFileSync } = require("fs");
const path = require("path");

function checkDatabase() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/database.sql"));
		return true;
	} catch {
		return false;
	}
}

function checkModifiedDatabase() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/database.modified.sql"));
		return true;
	} catch {
		return false;
	}
}

function checkHtaccess() {
	try {
		readFileSync(path.join(process.cwd(), "wp-env-bin/assets/.htaccess"));
		return true;
	} catch {
		return false;
	}
}

module.exports = { checkDatabase, checkModifiedDatabase, checkHtaccess };
