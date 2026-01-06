# Twitch EventSub

## Objectif
Recevoir des webhooks (stream.online/offline, channel.follow) pour alimenter l’app en temps réel.

## Sécurité
- Signature HMAC vérifiée (ID + Timestamp + Body).
- Rejet si timestamp > 10 minutes (anti-replay).
- Gestion de la révocation: tentative de réabonnement automatique.

## Maintenance
- Ensure périodique toutes les 15 minutes pour garantir les abonnements nécessaires.
- Prune quotidien: supprime expirés/invalides/doublons.

## Dev
- Utilisez un tunnel (ngrok/cloudflared) pour exposer le callback EventSub.
- Renseignez EVENTSUB_CALLBACK et EVENTSUB_SECRET.
