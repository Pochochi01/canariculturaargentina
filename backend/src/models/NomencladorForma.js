const mongoose = require('mongoose');

const NomencladorFormaSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nombreLinea: { type: String, required: true, trim: true },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('NomencladorForma', NomencladorFormaSchema);
