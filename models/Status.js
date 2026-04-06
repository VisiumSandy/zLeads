const mongoose = require('mongoose');

const defaultStatuses = [
  { name: 'À contacter',    color: '#64748b' },
  { name: 'Déjà appelé',    color: '#f59e0b' },
  { name: 'Intéressé',      color: '#3b82f6' },
  { name: 'Pas intéressé',  color: '#ef4444' },
  { name: 'RDV prévu',      color: '#22c55e' },
];

const statusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  color: {
    type: String,
    required: true,
    default: '#64748b',
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

statusSchema.statics.createDefaultsForUser = async function (userId) {
  const existing = await this.find({ userId });
  if (existing.length > 0) return existing;

  const docs = defaultStatuses.map((s, i) => ({
    ...s,
    userId,
    isDefault: true,
    order: i,
  }));
  return this.insertMany(docs);
};

module.exports = mongoose.model('Status', statusSchema);
