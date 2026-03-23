<?php
/**
 * Dynamic block render template.
 */

$wrapper_attrs = get_block_wrapper_attributes();
$heading = $attributes['heading'] ?? '';
$label   = $attributes['label'] ?? '';

if ( isset( $attributes['colorSlug'] ) ) {
	$color = $attributes['colorSlug'];
}
?>
<div <?php echo $wrapper_attrs; ?> aria-label="<?php echo esc_attr( $heading ); ?>" data-wp-interactive="my-plugin/dynamic-block">
	<h2><?php echo esc_html( $heading ); ?></h2>
	<button aria-pressed="false"><?php echo esc_html( $label ); ?></button>
	<img src="placeholder.jpg" alt="placeholder" />
</div>
