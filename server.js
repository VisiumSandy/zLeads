/**
 * LeadGen Maps CRM — Serveur principal
 * Recherche Google Places + CRM complet
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const { searchLeads } = require('./services/placesService');
const { requireAuth } = require('./middleware/auth');

const authRoutes     = require('./routes/auth');
const listRoutes     = require('./routes/lists');
const leadRoutes     = require('./routes/leads');
const statusRoutes   = require('./routes/statuses');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB ──────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/leadgen')
  .then(() => console.log('✅ MongoDB connecté'))
  .catch((err) => console.error('❌ MongoDB erreur:', err.message));

// ── Routes API ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/lists',    listRoutes);
app.use('/api/leads',    leadRoutes);
app.use('/api/statuses', statusRoutes);

/**
 * GET /search?q=...   — recherche Google Places (inchangée, protégée par auth)
 */
app.get('/search', requireAuth, async (req, res) => {
  const query = req.query.q;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Paramètre de recherche manquant ou trop court.' });
  }

  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'Clé API Google manquante. Vérifiez votre fichier .env' });
  }

  try {
    console.log(`\n🔍 Recherche: "${query}" (user: ${req.user.email})`);
    const results = await searchLeads(query.trim());
    console.log(`✅ ${results.length} résultats`);
    res.json({ results, total: results.length });
  } catch (err) {
    console.error('❌ Erreur serveur:', err.message);
    res.status(500).json({ error: err.message || 'Erreur interne du serveur' });
  }
});

// ── Routes Frontend ───────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/search-page', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/list/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 LeadGen Maps CRM démarré sur http://localhost:${PORT}`);
  console.log(`🔑 Google API Key: ${process.env.GOOGLE_API_KEY ? '✅' : '❌ MANQUANTE'}`);
  console.log(`🔐 JWT Secret:     ${process.env.JWT_SECRET ? '✅' : '⚠️  défaut (à changer)'}`);
  console.log(`🍃 MongoDB URI:    ${process.env.MONGODB_URI || 'mongodb://localhost:27017/leadgen'}`);
});
