<?php
/**
 * Plugin Name: WP Env Bin Plugin
 * Description: Local development helpers for wp-env-bin environments. Safe to deactivate.
 * Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

require_once __DIR__ . '/classes/class-service-worker.php';

new \WpEnvBin\Service_Worker();
