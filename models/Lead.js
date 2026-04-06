const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: { type: String, default: '' },
  phone: { type: String, default: '' },
  website: { type: String, default: '' },
  address: { type: String, default: '' },
  rating: { type: Number, default: null },
  reviews: { type: Number, default: 0 },
  googleMapsUrl: { type: String, default: '' },
  placeId: { type: String, default: '' },
  statusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Status',
    default: null,
  },
  notes: { type: String, default: '' },
  rdvDate: { type: Date, default: null },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Lead', leadSchema);