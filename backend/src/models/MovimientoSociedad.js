const mongoose = require('mongoose');

const MovimientoSchema = new mongoose.Schema({
  sociedadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', required: true },
  tipo:       { type: String, enum: ['ingreso', 'egreso'], required: true },
  concepto:   { type: String, required: true, trim: true },
  monto:      { type: Number, required: true },
  fecha:      { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('MovimientoSociedad', MovimientoSchema);
