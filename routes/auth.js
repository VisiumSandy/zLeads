const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Status = require('../models/Status');
const { generateToken, setTokenCookie, requireAuth } = require('../middleware/auth');

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Un compte avec cet email existe déjà' });
    }

    const user = await User.create({ email, password, name: name || email.split('@')[0] });

    // Créer les statuts par défaut
    await Status.createDefaultsForUser(user._id);

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.json({
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // S'assurer que les statuts par défaut existent
    await Status.createDefaultsForUser(user._id);

    const token = generateToken(user._id);
    setTokenCookie(res, token);

    res.json({
      user: { id: user._id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur de connexion' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      avatar: req.user.avatar,
    },
  });
});

/**
 * GET /api/auth/google
 * Redirige vers Google OAuth
 */
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Google OAuth non configuré' });
  }

  const redirectUri = encodeURIComponent(
    `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`
  );
  const scope = encodeURIComponent('openid email profile');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

  res.redirect(url);
});

/**
 * GET /api/auth/google/callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/auth?error=oauth_failed');

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

    // Échange le code contre un access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect('/auth?error=oauth_failed');

    // Récupère le profil Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profile.email) return res.redirect('/auth?error=oauth_failed');

    // Trouve ou crée l'utilisateur
    let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email: profile.email }] });

    if (!user) {
      user = await User.create({
        email: profile.email,
        googleId: profile.sub,
        name: profile.name || profile.email.split('@')[0],
        avatar: profile.picture || null,
      });
      await Status.createDefaultsForUser(user._id);
    } else if (!user.googleId) {
      user.googleId = profile.sub;
      user.avatar = profile.picture || user.avatar;
      await user.save();
    }

    const token = generateToken(user._id);
    setTokenCookie(res, token);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect('/auth?error=oauth_failed');
  }
});

module.exports = router;
