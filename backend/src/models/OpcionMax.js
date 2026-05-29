const mongoose = require('mongoose');

// Opciones disponibles para los campos maxIndividuales/maxDuos/maxCuartetos
const OpcionMaxSchema = new mongoose.Schema({
  valor: { type: String, required: true, unique: true, trim: true }, // e.g. 'libre', '2', '3', '5'
  label: { type: String, required: true, trim: true },               // e.g. 'Libre', '2', '3 por lote'
  orden: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('OpcionMax', OpcionMaxSchema);
