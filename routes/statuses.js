const express = require('express');
const router = express.Router();
const Status = require('../models/Status');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * GET /api/statuses — tous les statuts de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const statuses = await Status.find({ userId: req.user._id }).sort({ order: 1, createdAt: 1 });
    res.json({ statuses });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des statuts' });
  }
});

/**
 * POST /api/statuses — crée un statut personnalisé
 */
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nom de statut requis' });
    }

    const status = await Status.create({
      name: name.trim(),
      color: color || '#64748b',
      userId: req.user._id,
      isDefault: false,
    });

    res.status(201).json({ status });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création du statut' });
  }
});

/**
 * PATCH /api/statuses/:id — modifie un statut
 */
router.patch('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    const status = await Status.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { ...(name && { name: name.trim() }), ...(color && { color }) },
      { new: true }
    );
    if (!status) return res.status(404).json({ error: 'Statut introuvable' });
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

/**
 * DELETE /api/statuses/:id — supprime un statut custom
 */
router.delete('/:id', async (req, res) => {
  try {
    const status = await Status.findOne({ _id: req.params.id, userId: req.user._id });
    if (!status) return res.status(404).json({ error: 'Statut introuvable' });

    await status.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

module.exports = router;
