# Reverse proxy Nginx — Statisfaction

Ce guide décrit la mise en place d’un reverse proxy Nginx pour servir le frontend (Next.js) et l’API (Express) de Statisfaction derrière HTTPS.

## Architecture cible
- Web (Next.js) accessible sur 127.0.0.1:3100
- API (Express) accessible sur 127.0.0.1:4100
- Nginx en frontal (443/80) sur `statisfaction.sourcekod.fr`

## Fichier de configuration
Copiez le fichier `docs/nginx-statisfaction.conf` vers `/etc/nginx/sites-available/statisfaction.conf`, puis créez le lien symbolique:

```
sudo ln -s /etc/nginx/sites-available/statisfaction.conf /etc/nginx/sites-enabled/
```

Points clés inclus dans la conf proposée:
- Upstreams vers :3100 (web) et :4100 (api)
- Routage API explicite: `/api/`, `/auth/`, `/admin/`, `/webhooks/`, `/api/events` (SSE, proxy_buffering off)
- Cache long pour `/_next/static/` et cache raisonnable pour assets
- Redirection HTTP → HTTPS, TLS via Certbot (modifiez les chemins si besoin)

## Obtention du certificat TLS (Let’s Encrypt)
Avec Certbot (plugin nginx):
```
sudo certbot --nginx -d statisfaction.sourcekod.fr
```
Certbot ajoutera les directives `listen 443 ssl` et les chemins `ssl_certificate`/`ssl_certificate_key`.

## Démarrer les services applicatifs
- Web (Next.js):
```
# Build puis start
npm run build --workspace @statisfaction/web
npm run start --workspace @statisfaction/web
```
- API (server Express):
```
# Build puis start
npm run build --workspace @statisfaction/server
node apps/server/dist/index.js
```
Utilisez un process manager (PM2/systemd) en production.

### Lancement en une seule commande (web + server)

Au niveau racine du monorepo, des scripts combinés sont disponibles:

```
# Build les deux apps puis démarre web + server en parallèle
npm run build-and-start
```

### Exemple PM2 (ligne simple)

```
pm2 start --name statisfaction "npm run build-and-start"
```

PM2 relancera automatiquement la commande si le processus s’arrête. Pensez à configurer PM2 pour redémarrer au boot (pm2 startup / pm2 save).

## Vérifications & reload Nginx
```
sudo nginx -t
sudo systemctl reload nginx
```

## Notes
- Si vous changez les ports locaux, adaptez les upstreams.
- Si vous exposez `/health`, vous pouvez ajouter un check dédié (voir conf).
- Pour des headers de sécurité supplémentaires (CSP/Referrer-Policy), adaptez selon vos besoins.
