const mongoose = require('mongoose');

const ConfigCuotaSchema = new mongoose.Schema({
  sociedadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', required: true },
  año: { type: Number, required: true },
  montoCuotaMensual: { type: Number, default: 0 },
  montoCuotaAnual:   { type: Number, default: 0 },
  montoDerechoJaula: { type: Number, default: 0 }
}, { timestamps: true });

ConfigCuotaSchema.index({ sociedadId: 1, año: 1 }, { unique: true });

module.exports = mongoose.model('ConfigCuota', ConfigCuotaSchema);
