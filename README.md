# Statisfaction

Dashboard analytique pour streamers Twitch (MVP opérationnel).

## Fonctionnalités principales

- Authentification OAuth2 Twitch (login + re-consent scopes)
- Backend API (Express + Prisma/SQLite)
- Frontend (Next.js + Tailwind) en mode sombre
- Dashboard:
	- Live viewers (SSE) + messages/min (chat)
	- Overlays "moments à clipper" en temps réel
	- KPIs de période, heatmap horaires, conversion followers
- Outils:
	- Planificateur (CRUD + sync Twitch + export ICS)
	- Générateur de titres
	- Paramètres email (envoi récap)
- Récap post-stream: page dédiée + bouton “Envoyer le récap par mail”
- Raids: suggestions/candidats + démarrage de raid
- Clips: détection de moments, création de clip (Helix), historisation des clips créés

## Monorepo

- `apps/server` — API Node.js/Express + Prisma (SQLite)
- `apps/web` — Frontend Next.js 15 + Tailwind CSS

## Démarrage rapide

1. Installer les dépendances à la racine
2. Appliquer la migration Prisma (création DB SQLite)
3. Lancer serveur et web en parallèle

Variables d'environnement à copier depuis les `.env.example` et adapter (backend et frontend).

### Étapes

```bash
npm install

# Générer Prisma client et créer la DB
npm run prisma:generate --workspace @statisfaction/server
npm run prisma:migrate --workspace @statisfaction/server

# Lancer en dev (serveur 4000, web 3000)
npm run dev
```

Back-end écoute sur: http://localhost:4000 (selon environnement, préférez http://127.0.0.1:4000 si localhost/IPv6 pose problème)

Front-end: http://localhost:3000

## Env — Backend (`apps/server/.env`)

```
########################################
# Application / Serveur HTTP
########################################
PORT=4000
SESSION_SECRET=dev_super_secret_change_me
BASE_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

########################################
# Base de données Prisma (SQLite par défaut)
########################################
DATABASE_URL=file:./dev.db

########################################
# Sessions (optionnel, recommandé en prod)
########################################
#REDIS_URL=redis://localhost:6379
#COOKIE_SECURE=true

########################################
# Twitch API (OAuth + EventSub)
########################################
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:4000/auth/twitch/callback
#TWITCH_EVENTSUB_SECRET=choose_a_long_random_secret
#TWITCH_EVENTSUB_CALLBACK_URL=https://your-public-url/webhooks/twitch/eventsub

########################################
# Email SMTP (pour l’envoi du récap par mail)
########################################
#SMTP_HOST=
#SMTP_PORT=
#SMTP_SECURE=false
#SMTP_USER=
#SMTP_PASS=
#MAIL_FROM="Statisfaction <no-reply@example.com>"
```

### Créer une application Twitch (obligatoire)

1. Va sur https://dev.twitch.tv/console/apps et crée une app.
2. Renseigne un nom (ex: Statisfaction Dev), une catégorie (Website Integration).
3. Ajoute une Redirect URI: `http://localhost:4000/auth/twitch/callback`.
4. Copie le Client ID et génère un Client Secret.
5. Colle ces valeurs dans `apps/server/.env`.

## Env — Frontend (`apps/web/.env.local`)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

## Notes

- Les stats du dernier stream et les séries temporelles proviennent de la base (EventSub + polling Helix + ingestion tchat tmi.js).
- La conversion followers agrège `channel.follow` et calcule un taux horaire (/h) par stream. Dans le détail stream, une timeline (5 min) montre la répartition des follows.
- Les moments à clipper sont détectés par combinaison de spikes viewers et chat.
- L’email de récap est envoyé automatiquement à la fin du live si activé, ou manuellement depuis la page récap.
- En prod, utilisez un store de session persistant (Redis) et activez `COOKIE_SECURE=true` derrière HTTPS.
- Sécurité: le serveur utilise `helmet` et un rate limit par défaut (120 req/min). Adaptez selon vos besoins.

## Dépannage

- Si le serveur TS plante avec des types manquants, assure-toi que les dépendances sont installées: `npm install`.
- Si le login Twitch échoue, vérifie `TWITCH_REDIRECT_URI` et les scopes dans la console Twitch.
- Si le front ne charge pas Tailwind, vérifie `app/layout.tsx` importe `globals.css` et que `className="dark"` est présent sur `<html>`.
- Pour EventSub en local, expose le port 4000 avec un tunnel (ex: ngrok) et utilise l’URL publique pour `TWITCH_EVENTSUB_CALLBACK_URL`.
- Pour l’email en dev, vous pouvez utiliser MailHog (SMTP_HOST=localhost, SMTP_PORT=1025, SMTP_SECURE=false) ou un compte Ethereal.
 - Si `curl http://localhost:4000/health` échoue, essayez `curl http://127.0.0.1:4000/health` (nuances IPv4/IPv6 en container).
