# Dépannage

## Pubs AdSense ne s’affichent pas
- Vérifier consentement (bannière), client id, slots, domaine approuvé.

## Emails non reçus
- Vérifier SMTP_*; tester via outil SMTP; consulter logs server.

## EventSub silencieux
- Vérifier callback public, secret, logs, et lancer /admin endpoints de health/prune si existants.

## Build Next échoue
- Vérifier versions Node/pack; supprimer .next et relancer build.
