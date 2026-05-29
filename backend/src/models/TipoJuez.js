const mongoose = require('mongoose');

const TipoJuezSchema = new mongoose.Schema({
  valor: { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true },
  orden: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('TipoJuez', TipoJuezSchema);
