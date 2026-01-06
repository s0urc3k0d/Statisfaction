# 🗺️ Roadmap Statisfaction

## Phase 1 : Infrastructure (Priorité haute)

### 🐳 Dockerisation
- [x] Dockerfile pour le serveur Express
- [x] Dockerfile pour le frontend Next.js
- [x] docker-compose.yml avec tous les services
- [x] Configuration NGINX pour reverse proxy
- [x] Variables d'environnement (.env.example)
- [x] Migration SQLite → PostgreSQL (schema + script migration)
- [x] Intégration Redis pour le cache
- [ ] Scripts de migration de données (à tester)
- [ ] Documentation déploiement

**Services Docker :**
- `statisfaction-server` (Express API)
- `statisfaction-web` (Next.js frontend)
- `statisfaction-db` (PostgreSQL)
- `statisfaction-redis` (Cache)

---

## Phase 2 : Analytics avancées

### 📊 Comparaison de streams
- [x] API `/api/streams/compare?ids=1,2,3`
- [x] Calcul des deltas (viewers, durée, followers)
- [x] Identification des facteurs de succès
- [x] UI : sélection multiple + graphiques superposés
- [ ] Export comparatif PDF/image

### 📈 Rétention viewers
- [x] Tracking des "drop-offs" (moments de départ)
- [x] Courbe de rétention (% viewers restants vs temps)
- [x] Corrélation avec événements (changement de jeu, pause)
- [x] Score de rétention par stream
- [x] UI : visualisation courbe + points de drop-off
- [ ] Alertes si rétention < seuil

### 🎯 Prédiction meilleurs horaires
- [x] Agrégation historique par créneau (jour/heure)
- [x] Score composite : viewers moyens + followers/h + engagement chat
- [x] Algorithme de recommandation
- [x] UI : heatmap des créneaux + graphiques meilleurs horaires/jours
- [ ] Prise en compte des événements externes (holidays, events gaming)

### 🔗 Corrélation catégorie / performance
- [x] Stats agrégées par catégorie jouée
- [x] Classement des catégories par performance
- [x] Tendances : progression/régression par catégorie
- [x] Recommandations : "Tu performes +30% sur Just Chatting"
- [x] UI : pie chart temps + bar chart performance + tableau détaillé
- [ ] Comparaison avec la moyenne Twitch (si data dispo)

---

## Phase 3 : Analyse du chat ✅

### 💬 Analytics chat avancées
- [x] Word cloud des mots les plus utilisés
- [x] Filtrage des emotes/bots (liste de bots connus + détection emotes)
- [x] Timeline d'activité chat (messages/min)
- [x] Détection des "moments chat" (pics d'activité avec mots-clés)
- [x] Corrélation chat ↔ viewers (coefficient de Pearson + insights)

### 😊 Sentiment analysis
- [x] Classification emotes (positif/négatif/neutre)
- [x] Score de sentiment par segment de stream (buckets 5 min)
- [x] Détection des moments "hype" vs "toxiques"
- [ ] Alertes modération si sentiment négatif prolongé

### 🖥️ UI Chat Analytics
- [x] Page dédiée `/chat/[id]` avec 4 onglets
- [x] Vue générale (timeline + corrélation + aperçu moments)
- [x] Word cloud interactif avec filtrage emotes
- [x] Liste des moments forts avec mots-clés
- [x] Visualisation sentiment (stacked area chart + moments hype/toxiques)

---

## Phase 4 : Clips & Compilation ✅

### 🎬 Auto-clip intelligent
- [x] Création automatique de clip sur spike détecté
- [x] File d'attente de clips à valider
- [x] Seuils configurables par utilisateur
- [x] Preview avant validation
- [x] Suppression auto des clips non validés après X jours

### 🎞️ Compilation automatique
- [x] Sélection des top N moments du stream
- [x] Génération d'une playlist de clips
- [x] Export formats courts (TikTok/Shorts/Reels)
- [x] Ajout de transitions/textes basiques
- [x] Intégration FFmpeg pour le rendu

---

## Phase 5 : Cache Redis ✅

### ⚡ Optimisation performances
- [x] Cache des requêtes Twitch API (TTL 1-5 min)
- [x] Cache des calculs d'analytics (TTL 15 min)
- [x] Cache des sessions utilisateur
- [x] Invalidation intelligente sur événements
- [x] Métriques de hit/miss ratio

### 🔄 Pub/Sub temps réel
- [x] Remplacement SSE polling par Redis Pub/Sub
- [x] Synchronisation multi-instances
- [x] Queue de jobs pour tâches lourdes (récaps, compilations)

---

## Estimations

| Phase | Complexité | Durée estimée |
|-------|------------|---------------|
| Phase 1 - Docker | Moyenne | 1-2 semaines |
| Phase 2 - Analytics | Haute | 3-4 semaines |
| Phase 3 - Chat | Moyenne | 2 semaines |
| Phase 4 - Clips | Haute | 3-4 semaines |
| Phase 5 - Redis | Moyenne | 1-2 semaines |

---

## Notes techniques

### Migration SQLite → PostgreSQL
- Prisma supporte les deux, migration schema simple
- Script de migration des données existantes
- Backup avant migration

### Stack Docker finale
```
nginx (reverse proxy) ← VPS host
    ├── statisfaction-web:3100
    ├── statisfaction-server:4100
    ├── postgresql:5432
    └── redis:6379
```

### Variables d'environnement à ajouter
```env
# PostgreSQL
DATABASE_URL=postgresql://user:pass@statisfaction-db:5432/statisfaction

# Redis
REDIS_URL=redis://statisfaction-redis:6379

# Cache TTLs
CACHE_TTL_TWITCH_API=300
CACHE_TTL_ANALYTICS=900
```
