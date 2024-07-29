const htaccessTemplate = (url, siteId) => `${url && siteId ? `
# BEGIN Reverse proxy
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^wp-content\\/uploads\\/(.*)$ https:\\/\\/${url}\\/wp-content\\/uploads\\/sites\\/${siteId}\\/$1 [R=302,L,NC]
# END Reverse proxy
` : ''}

# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
# END WordPress
`;

module.exports = htaccessTemplate;