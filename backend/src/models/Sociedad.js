const mongoose = require('mongoose');

const SociedadSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nombre: { type: String, required: true, trim: true },
  provincia: { type: String, trim: true },
  direccion: { type: String, trim: true },
  telefono: { type: String, trim: true },
  mail: { type: String, trim: true, lowercase: true },
  federacion: { type: String, trim: true, uppercase: true, default: '' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  logo:    { type: String, default: '' },
  activa: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Sociedad', SociedadSchema);
