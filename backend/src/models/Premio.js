const mongoose = require('mongoose');

// Tipos de premio en orden de importancia (GCA = Gran Campeón Absoluto)
const TIPOS_PREMIO = ['GCA', 'CA', 'RC', '1°', '2°', '3°', '4°', '5°', '6°', '7°', '8°', '9°', '10°'];

const PremioSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: TIPOS_PREMIO,
    required: true,
    unique: true
  },
  label: { type: String, required: true, trim: true },
  puntosIndividual: { type: Number, default: 0, min: 0 },
  puntosDuos:       { type: Number, default: 0, min: 0 },
  puntosCuartetos:  { type: Number, default: 0, min: 0 },
  orden:            { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Premio', PremioSchema);
module.exports.TIPOS_PREMIO = TIPOS_PREMIO;
