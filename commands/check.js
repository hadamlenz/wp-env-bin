'use strict';
const { readFileSync } = require("fs");
const { logger } = require("./log.js");

/**
 * check to see if the htaccess exists
 * @returns bool
 */
function checkHtaccess(){
    var file = false;
    try {
		file = readFileSync("./assets/wp-env/.htaccess");
	} catch (err) {
		//logger('> no htaccess to get, make one with wilson-env make basic-htaccess');
		return false;
	}

    return true;
}

function isRunning(){

}

/**
 * check to see if the config exists and is formated corectly
 * @returns bool
 */
function checkConfig(){
    var file = false;
    try {
		file = readFileSync(".wp-env-bin.json");
	} catch (err) {
		//logger('> no config to get, make one with wilson-env make blank-config');
		return false;
	}

    if( file ){
        try {
            JSON.parse(file);
            return true;
        } catch (error) {
            logger('> the config is not properly formatted json');
            return false;
        }
    }
}


/**
 * check to see if the database for an external site exists
 * @returns bool
 */
function checkDatabase(){
    var file = false;
    try {
		file = readFileSync("./assets/wp-env/database.sql");
	} catch (err) {
		//logger('> no database exists, you should run wilson-env run config\n');
		return false;
	}
    return true;
}

module.exports = {
	checkConfig,
    checkDatabase,
    checkHtaccess,
};