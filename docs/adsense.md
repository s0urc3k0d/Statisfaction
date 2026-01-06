# Déploiement Google AdSense (Statisfaction)

Ce guide explique comment activer et déployer Google AdSense sur l'app web.

## 1) Pré-requis
- Compte Google AdSense approuvé pour le domaine `statisfaction.ovh`.
- Identifiant client AdSense: `ca-pub-7283351114219521`.

## 2) Variables d'environnement (web)
Fichier: `apps/web/.env.local`

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.statisfaction.ovh
NEXT_PUBLIC_SITE_URL=https://statisfaction.ovh

# AdSense
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-7283351114219521
```

## 3) Intégration technique

### Balise meta (automatique)
La balise `<meta name="google-adsense-account" content="ca-pub-7283351114219521">` est automatiquement ajoutée dans le `<head>` via `layout.tsx`.

### Script AdSense
Le script AdSense est chargé UNE SEULE FOIS via le composant `AdsenseInit.tsx` dans le layout principal :
- Il ne se charge qu'après consentement de l'utilisateur (`localStorage.consent_ads = '1'`)
- Aucun script dupliqué dans les pages individuelles

### Fichier ads.txt
Le fichier `public/ads.txt` contient :
```
google.com, pub-7283351114219521, DIRECT, f08c47fec0942fa0
```

## 4) Pages avec publicités

Les publicités sont affichées sur les **pages publiques** uniquement (indexables) :

| Page | Description | Emplacements pubs |
|------|-------------|-------------------|
| `/` | Accueil | 2 (hero + footer) |
| `/about` | À propos | 2 (milieu + footer) |
| `/features` | Fonctionnalités | 2 (hero + in-article) |
| `/guide` | Guide du streamer | 4 (entre sections) |
| `/privacy` | Confidentialité | 0 (pas de pub) |

Les pages privées (dashboard, tools, history, etc.) sont dans `robots.txt` disallow et n'affichent pas de publicités.

## 5) Consentement utilisateur (RGPD)

1. Une bannière de consentement s'affiche (`ConsentBanner`)
2. Tant que l'utilisateur n'a pas accepté, **aucun script AdSense n'est chargé**
3. Après consentement (`localStorage.consent_ads = '1'`), le script se charge
4. Les composants `<Adsense />` s'initialisent automatiquement

## 6) Composant Adsense

Utilisation simple dans les pages :

```tsx
import { Adsense } from '../components/Adsense';

// Auto-responsive
<Adsense format="auto" />

// Avec placeholder personnalisé
<Adsense format="auto" placeholderHeight={300} />
```

## 7) Checklist validation AdSense

Pour que Google valide le site, assurez-vous que :

- [x] **Contenu éditorial suffisant** : Chaque page publique a 300+ mots de contenu original
- [x] **Pages publiques riches** : `/`, `/about`, `/features`, `/guide` avec contenu substantiel
- [x] **Balise meta** : Présente dans le `<head>`
- [x] **Script AdSense** : Chargé après consentement
- [x] **ads.txt** : Accessible à `/ads.txt`
- [x] **robots.txt** : Pages privées disallow, pages publiques allow
- [x] **sitemap.xml** : Toutes les pages publiques listées
- [x] **Politique de confidentialité** : Page `/privacy` complète
- [x] **Consentement cookies** : Bannière RGPD fonctionnelle

## 8) Dépannage

### Erreur "Pages sans contenu d'éditeur"
- Vérifiez que les pages publiques ont suffisamment de contenu textuel
- Les pages de login/dashboard ne doivent PAS avoir de pubs

### Aucune pub ne s'affiche
1. Vérifiez le consentement dans `localStorage.consent_ads`
2. Vérifiez `NEXT_PUBLIC_ADSENSE_CLIENT` dans `.env.local`
3. Vérifiez la console pour les erreurs AdSense
4. Le domaine doit être approuvé par AdSense

### CLS (Layout Shift)
Ajustez `placeholderHeight` sur le composant `<Adsense />` pour réserver l'espace.

## 9) URLs importantes

- Site : https://statisfaction.ovh
- ads.txt : https://statisfaction.ovh/ads.txt
- robots.txt : https://statisfaction.ovh/robots.txt
- sitemap : https://statisfaction.ovh/sitemap.xml
