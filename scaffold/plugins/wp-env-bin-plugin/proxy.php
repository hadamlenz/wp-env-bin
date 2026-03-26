<?php
$file = ltrim( $_GET['file'] ?? '', '/' );
$base = rtrim( $_GET['base'] ?? '', '/' );

if ( ! $file || ! $base ) {
	http_response_code( 400 );
	exit;
}

// Security: only allow https:// upstream URLs.
if ( ! preg_match( '#^https://[^/]+#', $base ) ) {
	http_response_code( 403 );
	exit;
}

$remote_url = $base . '/' . $file;
$response   = @file_get_contents( $remote_url );

if ( $response === false ) {
	http_response_code( 404 );
	exit;
}

$ext      = strtolower( pathinfo( $file, PATHINFO_EXTENSION ) );
$mime_map = [
	'jpg'   => 'image/jpeg',
	'jpeg'  => 'image/jpeg',
	'png'   => 'image/png',
	'gif'   => 'image/gif',
	'webp'  => 'image/webp',
	'svg'   => 'image/svg+xml',
	'ico'   => 'image/x-icon',
	'woff'  => 'font/woff',
	'woff2' => 'font/woff2',
	'ttf'   => 'font/ttf',
	'pdf'   => 'application/pdf',
];

header( 'Access-Control-Allow-Origin: *' );
header( 'Content-Type: ' . ( $mime_map[ $ext ] ?? 'application/octet-stream' ) );
header( 'Cache-Control: public, max-age=3600' );
echo $response;
