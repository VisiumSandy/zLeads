const express = require('express');
const router = express.Router();
const List = require('../models/List');
const Lead = require('../models/Lead');
const { requireAuth } = require('../middleware/auth');

// All routes require auth
router.use(requireAuth);

/**
 * GET /api/lists — récupère toutes les listes de l'utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const lists = await List.find({ userId: req.user._id }).sort({ createdAt: -1 });

    // Ajoute le nombre de leads par liste
    const listsWithCount = await Promise.all(
      lists.map(async (list) => {
        const count = await Lead.countDocuments({ listId: list._id });
        return { ...list.toObject(), leadCount: count };
      })
    );

    res.json({ lists: listsWithCount });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des listes' });
  }
});

/**
 * POST /api/lists — crée une nouvelle liste avec des leads
 */
router.post('/', async (req, res) => {
  try {
    const { name, query, leads = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nom de liste requis' });
    }

    const list = await List.create({
      name: name.trim(),
      userId: req.user._id,
      query: query || '',
    });

    // Insère les leads si fournis
    if (leads.length > 0) {
      const leadDocs = leads.map((l) => ({
        listId: list._id,
        userId: req.user._id,
        name: l.name || '',
        phone: l.phone || '',
        website: l.website || '',
        address: l.address || '',
        rating: l.rating || null,
        reviews: l.reviews || 0,
        googleMapsUrl: l.google_maps_url || l.googleMapsUrl || '',
        placeId: l.place_id || l.placeId || '',
      }));

      await Lead.insertMany(leadDocs);
    }

    const leadCount = await Lead.countDocuments({ listId: list._id });

    res.status(201).json({ list: { ...list.toObject(), leadCount } });
  } catch (err) {
    console.error('Create list error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la liste' });
  }
});

/**
 * DELETE /api/lists/:id — supprime une liste et ses leads
 */
router.delete('/:id', async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.id, userId: req.user._id });
    if (!list) return res.status(404).json({ error: 'Liste introuvable' });

    await Lead.deleteMany({ listId: list._id });
    await list.deleteOne();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

/**
 * PATCH /api/lists/:id — renomme une liste
 */
router.patch('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const list = await List.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { name: name.trim() },
      { new: true }
    );
    if (!list) return res.status(404).json({ error: 'Liste introuvable' });
    res.json({ list });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

module.exports = router;
