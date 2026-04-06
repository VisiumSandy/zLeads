# CLAUDE.md — LeadGen Maps CRM

Ce fichier donne à Claude le contexte complet du projet pour pouvoir continuer le développement sans re-expliquer l'architecture.

---

## Présentation du projet

**LeadGen Maps CRM** est un outil de prospection B2B full-stack.  
Il permet de rechercher des entreprises locales via Google Places API, de les sauvegarder dans des listes, et de gérer leur suivi (statuts, appels, notes) comme un mini-CRM.

**Stack :** Node.js · Express · MongoDB (Mongoose) · Vanilla JS (SPA) · JWT auth  
**Version actuelle :** 2.0

---
## Architecture des fichiers
commande : fait les commande avec rtk avant pour reduire la consommer de token


## Architecture des fichiers

```
leadgen-maps/
├── server.js                  ← Point d'entrée Express. Monte toutes les routes.
│                                Connexion MongoDB. Route /search protégée par auth.
│
├── .env                       ← Variables d'environnement (ne jamais committer)
├── .env.example               ← Template public
├── package.json               ← Dépendances v2
│
├── middleware/
│   └── auth.js                ← requireAuth (JWT cookie ou Bearer header)
│                                generateToken(), setTokenCookie()
│                                JWT valide 30 jours, cookie httpOnly
│
├── models/
│   ├── User.js                ← email (unique), password (bcrypt), googleId, name, avatar
│   │                            Pre-save hook hash le password. comparePassword() method.
│   ├── Status.js              ← userId, name, color (#hex), isDefault, order
│   │                            createDefaultsForUser(userId) crée les 5 statuts par défaut
│   ├── List.js                ← name, userId, query (recherche d'origine), createdAt
│   └── Lead.js                ← listId, userId, name, phone, website, address,
│                                rating, reviews, googleMapsUrl, placeId,
│                                statusId (ref Status), notes, createdAt
│
├── routes/
│   ├── auth.js                ← POST /register /login /logout — GET /me /google /google/callback
│   ├── lists.js               ← GET / — POST / (avec leads[]) — PATCH /:id — DELETE /:id
│   ├── leads.js               ← GET /:listId — PATCH /:id/status — PATCH /:id/notes — DELETE /:id
│   └── statuses.js            ← GET / — POST / — PATCH /:id — DELETE /:id
│
├── services/
│   └── placesService.js       ← searchLeads(query) : génère variantes, pagine l'API Google,
│                                déduplique, récupère les détails (phone, website), trie par avis.
│                                NE PAS MODIFIER sans raison — c'est le cœur de valeur.
│
└── public/
    ├── landing.html           ← Page d'accueil publique (SaaS marketing)
    ├── auth.html              ← Login + Inscription (onglets) + Google OAuth button
    ├── app.html               ← SPA principale : dashboard, sidebar, recherche, vue liste, statuts
    └── index.html             ← Ancienne page v1 (ne plus utiliser)
```

---

## Variables d'environnement

```env
# Obligatoires
GOOGLE_API_KEY=        # Google Places API
MONGODB_URI=           # mongodb://localhost:27017/leadgen ou Atlas URI
JWT_SECRET=            # Chaîne aléatoire longue, changer en prod

# Optionnels
PORT=3000
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=      # OAuth Google
GOOGLE_CLIENT_SECRET=  # OAuth Google
```

---

## Routes complètes

### Pages frontend
| Route | Fichier servi |
|---|---|
| GET / | landing.html |
| GET /auth | auth.html |
| GET /dashboard | app.html |
| GET /search-page | app.html |
| GET /list/:id | app.html |

### API Auth (`/api/auth`)
| Méthode | Route | Auth | Description |
|---|---|---|---|
| POST | /register | ❌ | email + password + name? → crée user + statuts par défaut + JWT cookie |
| POST | /login | ❌ | email + password → JWT cookie |
| POST | /logout | ❌ | Clear cookie |
| GET | /me | ✅ | Renvoie { user: {id, email, name, avatar} } |
| GET | /google | ❌ | Redirect vers Google OAuth |
| GET | /google/callback | ❌ | Callback OAuth → crée/update user → redirect /dashboard |

### API Listes (`/api/lists`) — toutes ✅ auth
| Méthode | Route | Body | Description |
|---|---|---|---|
| GET | / | — | Toutes les listes + leadCount |
| POST | / | { name, query?, leads[] } | Crée liste + insère leads si fournis |
| PATCH | /:id | { name } | Renomme |
| DELETE | /:id | — | Supprime liste + tous ses leads |

### API Leads (`/api/leads`) — toutes ✅ auth
| Méthode | Route | Body | Description |
|---|---|---|---|
| GET | /:listId | — | Leads de la liste avec statusId peuplé |
| PATCH | /:id/status | { statusId } | Change le statut (null pour effacer) |
| PATCH | /:id/notes | { notes } | Met à jour les notes |
| DELETE | /:id | — | Supprime un lead |

### API Statuts (`/api/statuses`) — toutes ✅ auth
| Méthode | Route | Body | Description |
|---|---|---|---|
| GET | / | — | Tous les statuts triés par order |
| POST | / | { name, color } | Crée statut custom |
| PATCH | /:id | { name?, color? } | Modifie |
| DELETE | /:id | — | Supprime (custom seulement) |

### Recherche Google Places
| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | /search?q=... | ✅ | Appelle placesService.searchLeads() → { results[], total } |

---

## Modèles de données détaillés

### User
```js
{ email, password (bcrypt), googleId, name, avatar, createdAt }
```

### Status (5 créés par défaut à l'inscription)
```js
{ userId, name, color (#hex), isDefault (bool), order (int), createdAt }
// Défauts : À contacter(gris) · Déjà appelé(ambre) · Intéressé(bleu) · Pas intéressé(rouge) · RDV prévu(vert)
```

### List
```js
{ name, userId, query (recherche Google origine), createdAt }
```

### Lead
```js
{
  listId, userId,
  name, phone, website, address,
  rating (Number), reviews (Number),
  googleMapsUrl, placeId,
  statusId (ObjectId → Status, nullable),
  notes (String),
  createdAt
}
```

---

## Frontend — app.html (SPA)

Le fichier `app.html` est une **SPA vanilla JS** (~910 lignes). Pas de framework.

### Pages gérées
- **dashboard** — stats (nb listes, leads, statuts) + grille de cartes de listes
- **search** — barre de recherche + tableau résultats + bouton "Créer une liste"
- **list** — tableau des leads avec statuts colorés + actions (appel, copie, Maps, site, suppression)
- **statuses** — liste des statuts + création de statuts custom

### État global JS
```js
let currentUser       // { id, email, name, avatar }
let allLists          // toutes les listes de l'utilisateur
let allStatuses       // tous les statuts
let currentListId     // liste ouverte
let currentListLeads  // leads de la liste ouverte
let currentSearchResults  // résultats Google Places en cours
let currentSearchQuery    // query en cours
```

### Fonctions principales
```js
showPage(page, listId?)    // Router SPA
loadLists()                // GET /api/lists
loadStatuses()             // GET /api/statuses
openList(listId)           // GET /api/leads/:listId + rendu tableau
renderListTable()          // Rendu tableau leads avec statuts colorés
changeLeadStatus(id, sid)  // PATCH /api/leads/:id/status
startSearch()              // GET /search?q=...
saveList()                 // POST /api/lists avec currentSearchResults
```

### Auth frontend
- Au boot : GET /api/auth/me → si 401 → redirect /auth
- Logout : POST /api/auth/logout → clear cookie → redirect /auth
- Token JWT dans cookie httpOnly (pas de localStorage)

---

## Conventions de code

- **Pas de TypeScript** — JavaScript pur Node.js
- **Pas de bundler** — HTML/CSS/JS vanilla dans `/public`
- **Authentification** — toujours via `requireAuth` middleware sur toutes les routes API
- **Sécurité données** — chaque query MongoDB filtre toujours sur `userId: req.user._id`
- **Passwords** — bcrypt salt rounds 12, jamais renvoyés dans les réponses (`.select('-password')`)
- **Erreurs** — format uniforme `{ error: "message" }` avec code HTTP approprié
- **CSS** — variables CSS dans `:root`, design dark mode, palette cohérente

---

## Commandes

```bash
npm run dev    # node --watch server.js (hot reload)
npm start      # node server.js (production)
```

---

## Ce qui n'est PAS encore implémenté (pistes futures)

- Historique des appels par lead
- Notes enrichies (textarea dans modal)
- Filtres dans la vue liste (par statut, avec/sans tel, etc.)
- Import CSV de leads externes
- Renommage d'une liste depuis la vue liste
- Pagination des leads (actuellement tout chargé d'un coup)
- Partage de liste entre utilisateurs
- Statistiques de conversion par statut
- Notifications / rappels
- Mode mobile (responsive partiel)