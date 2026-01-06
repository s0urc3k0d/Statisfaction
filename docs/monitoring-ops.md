# Monitoring & Opérations

## Santé
- /health (server) renvoie { ok: true }.
- Logs: surveiller stream.online/offline, recap emails, EventSub ensure/prune.

## Maintenance planifiée
- Prune EventSub quotidien (24h).
- Rétention metrics: purge des StreamMetric > 180 jours.

## Suivi
- Ajoutez un agrégateur de logs (Papertrail, ELK) si nécessaire.
