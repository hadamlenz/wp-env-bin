const multisiteProxy = (url, siteId) => `
# BEGIN Reverse proxy
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^wp-content\\/uploads\\/sites\\/${siteId}\\/(.*)$ /wp-content/plugins/wp-env-bin-plugin/proxy.php?file=sites/${siteId}/$1&base=https://${url}/wp-content/uploads [L,NC]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^wp-content\\/uploads\\/(.*)$ /wp-content/plugins/wp-env-bin-plugin/proxy.php?file=sites/${siteId}/$1&base=https://${url}/wp-content/uploads [L,NC]
</IfModule>
# END Reverse proxy
`;

const singlesiteProxy = (url) => `
# BEGIN Reverse proxy
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^wp-content\\/uploads\\/(.*)$ /wp-content/plugins/wp-env-bin-plugin/proxy.php?file=$1&base=https://${url}/wp-content/uploads [L,NC]
</IfModule>
# END Reverse proxy
`;

const htaccessTemplate = (url, siteId, siteType = "singlesite") => {
	const proxy = siteType === "multisite" && url && siteId
		? multisiteProxy(url, siteId)
		: url
		? singlesiteProxy(url)
		: "";

	return `${proxy}
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
};

module.exports = htaccessTemplate;
