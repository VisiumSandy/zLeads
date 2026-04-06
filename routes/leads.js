const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const List = require('../models/List');
const Status = require('../models/Status');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

/**
 * GET /api/leads/:listId — leads d'une liste
 */
router.get('/:listId', async (req, res) => {
  try {
    const list = await List.findOne({ _id: req.params.listId, userId: req.user._id });
    if (!list) return res.status(404).json({ error: 'Liste introuvable' });

    const leads = await Lead.find({ listId: list._id })
      .populate('statusId')
      .sort({ createdAt: 1 });

    res.json({ leads, list });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des leads' });
  }
});

/**
 * GET /api/leads/rdv/all — tous les RDV de l'utilisateur (planning)
 */
router.get('/rdv/all', async (req, res) => {
  try {
    const leads = await Lead.find({
      userId: req.user._id,
      rdvDate: { $ne: null },
    })
      .populate('statusId')
      .populate('listId', 'name')
      .sort({ rdvDate: 1 });

    res.json({ leads });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des RDV' });
  }
});

/**
 * PATCH /api/leads/:id/status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { statusId } = req.body;
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ error: 'Lead introuvable' });

    if (statusId) {
      const status = await Status.findOne({ _id: statusId, userId: req.user._id });
      if (!status) return res.status(400).json({ error: 'Statut invalide' });
    }

    lead.statusId = statusId || null;
    await lead.save();

    const updated = await Lead.findById(lead._id).populate('statusId');
    res.json({ lead: updated });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

/**
 * PATCH /api/leads/:id/notes
 */
router.patch('/:id/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { notes },
      { new: true }
    ).populate('statusId');

    if (!lead) return res.status(404).json({ error: 'Lead introuvable' });
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

/**
 * PATCH /api/leads/:id/rdv — définit ou supprime la date de RDV
 */
router.patch('/:id/rdv', async (req, res) => {
  try {
    const { rdvDate } = req.body;
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { rdvDate: rdvDate ? new Date(rdvDate) : null },
      { new: true }
    ).populate('statusId').populate('listId', 'name');

    if (!lead) return res.status(404).json({ error: 'Lead introuvable' });
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du RDV' });
  }
});

/**
 * DELETE /api/leads/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ error: 'Lead introuvable' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

module.exports = router;