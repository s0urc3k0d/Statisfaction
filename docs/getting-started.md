# Démarrage rapide (local)

## Prérequis
- Node.js 18+ (ou 20+ recommandé)
- Docker (optionnel pour DB)

## Installation
```
npm install
```

## Variables d’environnement
- Copiez et ajustez `apps/server/.env.example` → `apps/server/.env`
- Copiez et ajustez `apps/web/.env.local.example` → `apps/web/.env.local`

## Base de données
- Par défaut: SQLite (fichier), Prisma gère les migrations.
```
npm run prisma:migrate
```

## Lancer en dev
```
npm run dev
```
- Web: http://localhost:3000
- API: http://localhost:4000

## Comptes Twitch
- Créez une application sur https://dev.twitch.tv/console/apps
- Renseignez les Client ID/Secret + scopes dans le .env server.
- Configurez le callback OAuth et (si utilisé) l’EventSub callback (URL publique).
