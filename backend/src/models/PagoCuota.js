const mongoose = require('mongoose');

// Un pago puede cubrir uno o varios meses (pago anual) o ser un derecho de jaula
const PagoCuotaSchema = new mongoose.Schema({
  socioId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Socio', required: true },
  sociedadId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', required: true },
  tipo:          { type: String, enum: ['mensual', 'anual', 'derecho_jaula'], required: true },
  // para mensual/anual: lista de meses que cubre
  meses:         [{ mes: { type: Number, min: 1, max: 12 }, año: Number }],
  // para derecho_jaula
  cantidadJaulas: { type: Number, default: 0 },
  competenciaId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Competencia', default: null },
  monto:         { type: Number, required: true },
  concepto:      { type: String, trim: true, default: '' },
  fechaPago:     { type: Date, default: Date.now },
  nroRecibo:     { type: String, trim: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('PagoCuota', PagoCuotaSchema);
