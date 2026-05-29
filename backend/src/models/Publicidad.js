const mongoose = require('mongoose');
const { Schema } = mongoose;

const PublicidadSchema = new Schema({
  tipo: {
    type: String,
    enum: ['cover', 'backcover', 'fullpage', 'halfpage', 'quarterpage', 'grades'],
    required: true
  },
  // Solo para fullpage: 'peers' (páginas pares) | 'odd' (páginas impares)
  subtipo: { type: String, enum: ['peers', 'odd'], default: null },
  competenciaId: { type: Schema.Types.ObjectId, ref: 'Competencia', required: true },
  año: { type: Number },
  filename: { type: String, required: true },
  originalName: { type: String, default: '' },
  orden: { type: Number, default: 0 }
}, { timestamps: true });

PublicidadSchema.index({ competenciaId: 1, tipo: 1, orden: 1 });

module.exports = mongoose.model('Publicidad', PublicidadSchema);
