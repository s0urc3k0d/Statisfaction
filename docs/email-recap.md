# Récapitulatif e-mail

## Objectif
Envoyer automatiquement un récap de fin de stream (et manuel via l’UI) au streamer.

## SMTP configuration
- Variables: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
- Activez le flag/toggle côté UI (Tools) et fournissez une adresse e-mail.

## Contenu
- Utilise computeRecap côté serveur (KPIs, moments, fun facts).
- Envoi auto sur stream.offline si le toggle est activé.
