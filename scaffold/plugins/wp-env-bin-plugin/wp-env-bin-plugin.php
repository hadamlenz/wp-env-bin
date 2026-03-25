<?php
/**
 * Plugin Name: WP Env Bin Plugin
 * Description: Local development helpers for wp-env-bin environments. Safe to deactivate.
 * Version: 1.0.0
 * Author: Adam Lenz
 * License: GPL2
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-env-bin-plugin
 * Domain Path: /languages
 * 
 * if you add more files to this plugin, 
 * make sure to update the version number and add a changelog entry in the readme.txt file.
 * make sure you add a new files to the PLUGIN_FILES array in commands/setup.js
 */

if ( ! defined( 'ABSPATH' ) ) exit;

require_once __DIR__ . '/classes/class-service-worker.php';

new \WpEnvBin\Service_Worker();
