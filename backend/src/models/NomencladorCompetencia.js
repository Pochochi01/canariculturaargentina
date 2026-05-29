const mongoose = require('mongoose');

const NomencladorCompetenciaSchema = new mongoose.Schema({
  competenciaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competencia',
    required: true,
    unique: true
  },
  nombreCompetencia: { type: String, required: true, trim: true },
  filenameColor:     { type: String, required: true },
  filenameForma:     { type: String, required: true },
  añoBase:           { type: Number },
  fechaAsignacion:   { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('NomencladorCompetencia', NomencladorCompetenciaSchema);
