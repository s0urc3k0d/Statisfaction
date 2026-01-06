# 🚀 Guide de Déploiement Statisfaction

Guide complet pour déployer Statisfaction sur un VPS avec Docker, Nginx et SSL.

## 📋 Table des matières

1. [Prérequis](#1-prérequis)
2. [Configuration DNS](#2-configuration-dns)
3. [Installation Docker](#3-installation-docker)
4. [Création de l'application Twitch](#4-création-de-lapplication-twitch)
5. [Configuration du projet](#5-configuration-du-projet)
6. [Déploiement avec Docker Compose](#6-déploiement-avec-docker-compose)
7. [Configuration Nginx](#7-configuration-nginx)
8. [Installation du certificat SSL](#8-installation-du-certificat-ssl)
9. [Configuration finale Nginx](#9-configuration-finale-nginx)
10. [Vérifications post-déploiement](#10-vérifications-post-déploiement)
11. [Maintenance](#11-maintenance)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prérequis

### Serveur
- VPS avec Ubuntu 22.04+ ou Debian 12+
- Minimum 2 Go RAM, 20 Go stockage
- Accès root ou sudo
- Ports 80 et 443 ouverts dans le firewall

### Domaine
- Un domaine configuré (ex: `statisfaction.ovh`)
- Accès aux paramètres DNS

### Logiciels requis
```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des utilitaires
sudo apt install -y curl wget git nano ufw
```

---

## 2. Configuration DNS

Connectez-vous à votre gestionnaire DNS et créez les enregistrements suivants :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | @ | `VOTRE_IP_VPS` | 3600 |
| A | www | `VOTRE_IP_VPS` | 3600 |

> ⏳ **Note** : La propagation DNS peut prendre jusqu'à 24h (généralement 5-30 min).

### Vérification
```bash
# Depuis votre VPS ou ailleurs
dig +short statisfaction.ovh
dig +short www.statisfaction.ovh
```

---

## 3. Installation Docker

### Installation automatique
```bash
# Installation de Docker
curl -fsSL https://get.docker.com | sudo sh

# Ajout de l'utilisateur au groupe docker
sudo usermod -aG docker $USER

# Installation de Docker Compose
sudo apt install -y docker-compose-plugin

# Déconnexion/reconnexion pour appliquer les groupes
exit
# Reconnectez-vous en SSH
```

### Vérification
```bash
docker --version
docker compose version
```

---

## 4. Création de l'application Twitch

### 4.1 Création de l'app

1. Allez sur [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps)
2. Cliquez sur **"Register Your Application"**
3. Remplissez :
   - **Name** : Statisfaction (ou nom de votre choix)
   - **OAuth Redirect URLs** : `https://statisfaction.ovh/auth/twitch/callback`
   - **Category** : Website Integration
4. Cliquez sur **"Create"**

### 4.2 Récupération des credentials

1. Cliquez sur **"Manage"** sur votre app
2. Notez le **Client ID**
3. Cliquez sur **"New Secret"** et notez le **Client Secret**

> ⚠️ **Important** : Le Client Secret n'est affiché qu'une fois !

### 4.3 Configuration EventSub (Webhooks)

Pour que les webhooks fonctionnent, votre URL doit être accessible publiquement en HTTPS.
L'URL de callback sera : `https://statisfaction.ovh/webhooks/eventsub`

---

## 5. Configuration du projet

### 5.1 Cloner le projet

```bash
# Créer le dossier d'installation
sudo mkdir -p /var/www/statisfaction
sudo chown ubuntu:ubuntu /var/www/statisfaction
cd /var/www/statisfaction

# Cloner le repository
git clone https://github.com/s0urc3k0d/Statisfaction.git .
```

### 5.2 Création du fichier .env

```bash
# Copier le template
cp deploy/.env.example deploy/.env

# Éditer les variables
nano deploy/.env
```

### Variables à configurer

```env
# Base de données (changez le mot de passe !)
POSTGRES_USER=statisfaction
POSTGRES_PASSWORD=VotreMotDePasseSecurise123!
POSTGRES_DB=statisfaction

# Session (générez avec: openssl rand -hex 32)
SESSION_SECRET=coller_ici_le_resultat_de_openssl_rand_hex_32

# Twitch (copiez depuis dev.twitch.tv)
TWITCH_CLIENT_ID=votre_client_id
TWITCH_CLIENT_SECRET=votre_client_secret

# EventSub (générez avec: openssl rand -hex 20)
TWITCH_EVENTSUB_SECRET=coller_ici_le_resultat

# Email (optionnel - pour les récaps)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre@gmail.com
SMTP_PASS=votre_app_password
SMTP_FROM="Statisfaction <no-reply@statisfaction.ovh>"
```

### Génération des secrets

```bash
# Pour SESSION_SECRET
openssl rand -hex 32

# Pour TWITCH_EVENTSUB_SECRET
openssl rand -hex 20
```

---

## 6. Déploiement avec Docker Compose

### 6.1 Lancement de la stack

```bash
cd /var/www/statisfaction

# Lancement en production
docker compose -f deploy/docker-compose.prod.yml up -d

# Vérification des logs
docker compose -f deploy/docker-compose.prod.yml logs -f
```

### 6.2 Vérification des services

```bash
# Vérifier que tous les conteneurs sont running
docker compose -f deploy/docker-compose.prod.yml ps

# Test de connexion locale
curl http://127.0.0.1:3100  # Frontend
curl http://127.0.0.1:4100/health  # API
```

### 6.3 Initialisation de la base de données

Les migrations Prisma sont appliquées automatiquement au démarrage.
Pour vérifier :

```bash
# Accéder au conteneur serveur
docker compose -f deploy/docker-compose.prod.yml exec server sh

# Vérifier les migrations
npx prisma migrate status
exit
```

---

## 7. Configuration Nginx

### 7.1 Installation de Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 7.2 Configuration initiale (HTTP)

```bash
# Copier la configuration pré-SSL
sudo cp deploy/nginx/statisfaction.conf.before-certbot /etc/nginx/sites-available/statisfaction.conf

# Activer le site
sudo ln -sf /etc/nginx/sites-available/statisfaction.conf /etc/nginx/sites-enabled/

# Désactiver le site par défaut (optionnel)
sudo rm -f /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### 7.3 Vérification

```bash
# Le site devrait être accessible en HTTP
curl -I http://statisfaction.ovh
```

---

## 8. Installation du certificat SSL

### 8.1 Installation de Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.2 Obtention du certificat

```bash
sudo certbot --nginx -d statisfaction.ovh -d www.statisfaction.ovh
```

Répondez aux questions :
1. **Email** : Votre email (pour les alertes d'expiration)
2. **Terms of Service** : Y (Yes)
3. **Share email** : N (No, sauf si vous voulez)
4. **Redirect HTTP to HTTPS** : 2 (Yes, redirect)

### 8.3 Vérification du renouvellement automatique

```bash
# Test de renouvellement (dry run)
sudo certbot renew --dry-run

# Vérifier le timer systemd
sudo systemctl status certbot.timer
```

---

## 9. Configuration finale Nginx

### 9.1 Remplacement par la config complète

Après l'obtention du certificat SSL :

```bash
# Sauvegarder la config générée par Certbot
sudo cp /etc/nginx/sites-available/statisfaction.conf /etc/nginx/sites-available/statisfaction.conf.certbot-backup

# Copier notre configuration HTTPS complète
sudo cp deploy/nginx/statisfaction.conf /etc/nginx/sites-available/statisfaction.conf

# Tester et recharger
sudo nginx -t
sudo systemctl reload nginx
```

### 9.2 Vérification complète

```bash
# Test HTTPS
curl -I https://statisfaction.ovh

# Test redirection www
curl -I https://www.statisfaction.ovh

# Test API
curl https://statisfaction.ovh/api/health

# Test SSE (doit rester ouvert)
curl -N https://statisfaction.ovh/api/sse
```

---

## 10. Vérifications post-déploiement

### 10.1 Checklist

- [ ] Site accessible en HTTPS
- [ ] Redirection HTTP → HTTPS
- [ ] Redirection www → non-www
- [ ] Login Twitch fonctionnel
- [ ] Dashboard accessible après login
- [ ] SSE (temps réel) fonctionnel
- [ ] Pas d'erreurs dans les logs

### 10.2 Tests fonctionnels

```bash
# Ouvrir dans un navigateur
https://statisfaction.ovh

# Se connecter avec Twitch
# Vérifier le dashboard
# Tester le chat en temps réel (si vous êtes live)
```

### 10.3 Création d'un admin (optionnel)

```bash
# Remplacez VOTRE_ID_TWITCH par votre ID
docker compose -f deploy/docker-compose.prod.yml exec server \
  npx ts-node scripts/make_admin.ts VOTRE_ID_TWITCH
```

---

## 11. Maintenance

### 11.1 Mise à jour de l'application

```bash
cd /var/www/statisfaction

# Récupérer les dernières modifications
git pull

# Reconstruire les images
docker compose -f deploy/docker-compose.prod.yml build

# Redémarrer avec les nouvelles images
docker compose -f deploy/docker-compose.prod.yml up -d

# Nettoyer les anciennes images
docker image prune -f
```

### 11.2 Sauvegarde de la base de données

```bash
# Créer un backup
docker compose -f deploy/docker-compose.prod.yml exec db \
  pg_dump -U statisfaction statisfaction > backup_$(date +%Y%m%d_%H%M%S).sql

# Script de backup automatique (ajoutez au cron)
# crontab -e
# 0 3 * * * cd /var/www/statisfaction && docker compose -f deploy/docker-compose.prod.yml exec -T db pg_dump -U statisfaction statisfaction > /var/www/backups/statisfaction_$(date +\%Y\%m\%d).sql
```

### 11.3 Logs et monitoring

```bash
# Logs de tous les services
docker compose -f deploy/docker-compose.prod.yml logs -f

# Logs d'un service spécifique
docker compose -f deploy/docker-compose.prod.yml logs -f server
docker compose -f deploy/docker-compose.prod.yml logs -f web

# Utilisation des ressources
docker stats
```

### 11.4 Renouvellement SSL

Le renouvellement est automatique via le timer Certbot.
Pour forcer un renouvellement :

```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## 12. Troubleshooting

### Problème : Le site ne charge pas

```bash
# Vérifier Nginx
sudo systemctl status nginx
sudo nginx -t

# Vérifier les conteneurs
docker compose -f deploy/docker-compose.prod.yml ps

# Vérifier les logs
docker compose -f deploy/docker-compose.prod.yml logs --tail=100
```

### Problème : Erreur 502 Bad Gateway

```bash
# L'application ne répond pas
# Vérifier que les ports sont bien mappés
docker compose -f deploy/docker-compose.prod.yml ps

# Tester en local
curl http://127.0.0.1:3100
curl http://127.0.0.1:4100/health
```

### Problème : Login Twitch ne fonctionne pas

1. Vérifiez l'URL de callback dans Twitch Console
2. Vérifiez TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET dans .env
3. Vérifiez les logs :
```bash
docker compose -f deploy/docker-compose.prod.yml logs server | grep -i twitch
```

### Problème : SSE ne fonctionne pas

Vérifiez la config Nginx pour `/api/sse` :
- `proxy_buffering off`
- `proxy_read_timeout` suffisant
- Headers SSE corrects

### Problème : Base de données inaccessible

```bash
# Vérifier le conteneur PostgreSQL
docker compose -f deploy/docker-compose.prod.yml logs db

# Se connecter à la BDD
docker compose -f deploy/docker-compose.prod.yml exec db psql -U statisfaction

# Vérifier les tables
\dt
\q
```

### Problème : Certificat SSL expiré

```bash
# Vérifier l'expiration
sudo certbot certificates

# Renouveler manuellement
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## 🎉 Félicitations !

Votre instance Statisfaction est maintenant déployée et accessible sur `https://statisfaction.ovh` !

### Prochaines étapes recommandées :

1. **Configurer les alertes email** pour les erreurs serveur
2. **Mettre en place des backups automatiques** de la base de données
3. **Configurer un monitoring** (Uptime Kuma, Grafana, etc.)
4. **Activer fail2ban** pour la sécurité
5. **Valider AdSense** si vous utilisez la publicité

### Support

- 📖 [Documentation complète](./docs/)
- 🐛 [Signaler un bug](https://github.com/s0urc3k0d/Statisfaction/issues)
- 💬 [Discord](https://discord.gg/statisfaction)
