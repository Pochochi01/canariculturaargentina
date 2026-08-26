const mongoose = require('mongoose');

const NotificacionSchema = new mongoose.Schema({
  socioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Socio', required: true },
  tipo: {
    type: String,
    enum: ['fertilidad', 'nacimiento', 'anillado'],
    required: true
  },
  titulo: { type: String, required: true, trim: true },
  mensaje: { type: String, required: true, trim: true },
  fechaVencimiento: { type: Date, required: true },
  entidadId: { type: mongoose.Schema.Types.ObjectId, default: null },
  entidadTipo: { type: String, enum: ['puesta', 'huevo'], default: null },
  leida: { type: Boolean, default: false },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

NotificacionSchema.index({ socioId: 1, leida: 1, fechaVencimiento: 1 });

module.exports = mongoose.model('Notificacion', NotificacionSchema);
