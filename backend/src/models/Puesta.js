const mongoose = require('mongoose');

const HuevoSchema = new mongoose.Schema({
  numero: { type: Number, required: true },
  estado: {
    type: String,
    enum: ['incubando', 'eclosionado', 'no_fertilizado', 'roto', 'abandonado', 'muerto_en_huevo', 'muerto_antes_anillar'],
    default: 'incubando'
  },
  fechaInicioIncubacion: { type: Date, default: null },
  // Si el huevo fue pasado a otra pareja nodriza
  parejaNodrizaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pareja', default: null },
  // Ejemplar nacido de este huevo (solo si eclosionado y anillado)
  ejemplarId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ejemplar', default: null },
}, { _id: true });

const PuestaSchema = new mongoose.Schema({
  parejaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pareja', required: true },
  socioId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Socio',  required: true },
  numPuesta: { type: Number, default: 1 },           // 1ª puesta, 2ª puesta, etc.
  fechaInicioPuesta: { type: Date, default: null },
  fechaInicioIncubacion: { type: Date, default: null },
  huevos: { type: [HuevoSchema], default: [] },
  comentarios: { type: String, trim: true, default: '' },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

PuestaSchema.index({ parejaId: 1, socioId: 1 });

module.exports = mongoose.model('Puesta', PuestaSchema);
