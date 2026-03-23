<?php
namespace WpEnvBin;

class Service_Worker {
	public function __construct() {
		add_action( 'wp_enqueue_scripts', [ $this, 'deregister' ], 100 );
		add_action( 'admin_enqueue_scripts', [ $this, 'deregister' ], 100 );
	}

	public function deregister() {
		wp_deregister_script( 'wp-service-worker' );
	}
}
