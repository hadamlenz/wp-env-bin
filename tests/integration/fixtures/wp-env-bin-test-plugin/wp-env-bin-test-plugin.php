<?php
/**
 * Plugin Name: WP Env Bin Test Plugin
 * Description: Fixture plugin for wp-env-bin integration tests. Do not use on production.
 * Version: 1.0.0
 * Text Domain: wp-env-bin-test-plugin
 */

register_activation_hook( __FILE__, function () {
	update_option( 'wp_env_bin_test_marker', 'integration-test-v1' );
} );
