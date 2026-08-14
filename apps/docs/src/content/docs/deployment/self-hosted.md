---
title: Self-hosted
description: Run the static build output on any HTTP server — Nginx, Caddy, Apache, GitHub Pages, S3 + CloudFront.
---

Grove emits a fully static `dist/` directory. Any HTTP server that can serve files can host a Grove space. This page covers the recommended setups for common servers.

## Nginx

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/grove/dist;
    index index.html;

    # Astro static output uses path-based routing
    location / {
        try_files $uri $uri/ $uri.html /404.html;
    }

    # Long cache for hashed assets
    location /_astro/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

## Caddy

```caddy
example.com {
    root * /var/www/grove/dist
    encode gzip zstd
    try_files {path} {path}.html /404.html

    @assets path /_astro/*
    header @assets Cache-Control "public, max-age=31536000, immutable"
}
```

Caddy's automatic HTTPS via Let's Encrypt makes this the lowest-friction option for self-hosters.

## Apache

```apache
<VirtualHost *:80>
    ServerName example.com
    DocumentRoot /var/www/grove/dist
    <Directory /var/www/grove/dist>
        AllowOverride All
    </Directory>
</VirtualHost>
```

With `.htaccess`:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /$1.html [L]

<IfModule mod_expires.c>
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType text/css "access plus 1 year"
</IfModule>
```

## S3 + CloudFront

```bash
aws s3 sync dist/ s3://example.com --delete
aws cloudfront create-invalidation --distribution-id E123 --paths "/*"
```

Set bucket website hosting to redirect unknown paths to `/404.html`.

## Local preview

```bash
pnpm exec grove check
pnpm build
pnpm exec serve dist
```

## Related

- [GitHub Pages](/deployment/github-pages/)
- [Cloudflare](/deployment/cloudflare/)
- [Netlify](/deployment/netlify/)