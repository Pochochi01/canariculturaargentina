const mongoose = require('mongoose');

const ParejaSchema = new mongoose.Schema({
  socioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Socio', required: true },
  machoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejemplar', required: true },
  hembraId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejemplar', required: true },
  fechaEmparejamiento: { type: Date, default: null },
  numJaula: { type: String, trim: true, default: '' },
  fechaPuestaNido: { type: Date, default: null },
  comentarios: { type: String, trim: true, default: '' },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

ParejaSchema.index({ socioId: 1 });

module.exports = mongoose.model('Pareja', ParejaSchema);
