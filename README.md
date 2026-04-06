# 📍 LeadGen Maps CRM — v2.0

> CRM de prospection complet basé sur Google Places API

## Structure

```
├── server.js              ← Express + MongoDB + routes
├── models/                ← User, Status, List, Lead
├── middleware/auth.js     ← JWT cookie auth
├── routes/                ← auth, lists, leads, statuses
├── services/placesService.js  ← Google Places (inchangé)
└── public/
    ├── landing.html       ← Page d'accueil
    ├── auth.html          ← Login / Inscription
    └── app.html           ← SPA (dashboard + CRM)
```

## Installation rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer .env
GOOGLE_API_KEY=votre_cle
MONGODB_URI=mongodb://localhost:27017/leadgen
JWT_SECRET=changez_cette_valeur

# 3. Lancer MongoDB
mongod  # ou brew services start mongodb-community

# 4. Démarrer
npm run dev
```

## Nouvelles dépendances (v2)
- mongoose — MongoDB ORM
- bcryptjs — hash mots de passe
- jsonwebtoken — sessions JWT
- cookie-parser — lecture cookie JWT

## Variables .env

| Variable | Obligatoire | Description |
|---|---|---|
| GOOGLE_API_KEY | ✅ | Clé Google Places API |
| MONGODB_URI | ✅ | URI MongoDB |
| JWT_SECRET | ✅ | Secret JWT (changer en prod) |
| PORT | ❌ | Port (défaut: 3000) |
| APP_URL | ❌ | URL app (pour OAuth callback) |
| GOOGLE_CLIENT_ID | ❌ | OAuth Google |
| GOOGLE_CLIENT_SECRET | ❌ | OAuth Google |

## Endpoints API

### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET  /api/auth/me
- GET  /api/auth/google

### Listes
- GET    /api/lists
- POST   /api/lists
- PATCH  /api/lists/:id
- DELETE /api/lists/:id

### Leads
- GET    /api/leads/:listId
- PATCH  /api/leads/:id/status
- PATCH  /api/leads/:id/notes
- DELETE /api/leads/:id

### Statuts
- GET    /api/statuses
- POST   /api/statuses
- PATCH  /api/statuses/:id
- DELETE /api/statuses/:id

### Recherche
- GET /search?q=plombier+Auxerre  (authentifié)

## Statuts par défaut
Créés automatiquement à l'inscription :
- À contacter (gris)
- Déjà appelé (ambre)
- Intéressé (bleu)
- Pas intéressé (rouge)
- RDV prévu (vert)
