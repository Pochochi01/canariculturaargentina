const mongoose = require('mongoose');

const NomencladorColorSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nombreLinea: { type: String, required: true, trim: true },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('NomencladorColor', NomencladorColorSchema);
