# Déploiement (production)

## Choix d’infra
- Monorepo Node (Next.js + Express). Déployable en VM/Container.
- DB: SQLite par défaut; peut évoluer vers Postgres.

## Étapes générales
1. Construire:
```
npm run build
```
2. Migrer la DB (server):
```
npm run prisma:migrate
```
3. Démarrer:
```
# Exemple: PM2 / systemd / Docker
npm run start --workspace @statisfaction/web
node apps/server/dist/index.js
```

## Reverse proxy
- Nginx/Caddy/Traefik pour servir `apps/web` et proxy `apps/server`.
- Force HTTPS en prod.

## Variables d’environnement clés
- FRONTEND_URL, BASE_URL, TWITCH_* , EVENTSUB_*, SMTP_*
- Voir `env-reference.md`.

## EventSub (production)
- Fournissez une URL publique HTTPS pour le callback EventSub.
- Configurez un secret fort et conservez-le.

## Monitoring & sauvegardes
- Voir `monitoring-ops.md`.
