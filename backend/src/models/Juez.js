const mongoose = require('mongoose');

const JuezSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nombre: { type: String, required: true, trim: true },
  apellido: { type: String, required: true, trim: true, uppercase: true },
  dni: { type: String, required: true, unique: true, trim: true },
  federacion: { type: String, enum: ['FAC', 'FOA', 'FOCI', ''], default: '' },
  tipoJuez: { type: String, enum: ['Color', 'Forma', 'Canto', ''], default: '' },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Juez', JuezSchema);
