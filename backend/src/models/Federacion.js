const mongoose = require('mongoose');

const FederacionSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nombre: { type: String, trim: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Federacion', FederacionSchema);
