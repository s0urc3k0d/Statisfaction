# Sécurité

- Sessions sécurisées (cookie httpOnly, sameSite=lax, secure en prod HTTPS).
- Helmet + rate limit sur l’API.
- Signatures HMAC EventSub vérifiées + timestamp.
- OAuth Twitch: scopes minimaux nécessaires, re-consent non bloquant.
- SMTP: ne loggez jamais les secrets; utilisez des variables d’env.
