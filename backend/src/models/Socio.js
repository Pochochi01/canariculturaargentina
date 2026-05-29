const mongoose = require('mongoose');

const SocioSchema = new mongoose.Schema({
  anilloCriador: { type: String, required: true, trim: true, uppercase: true },
  apellido: { type: String, required: true, trim: true, uppercase: true },
  nombre: { type: String, required: true, trim: true },
  dni: { type: String, required: true, trim: true },
  domicilio: { type: String, trim: true },
  correo: { type: String, trim: true, lowercase: true },
  telefono: { type: String, trim: true },
  direccion: { type: String, trim: true },
  sociedadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fotoPerfil: { type: String, default: '' },  // nombre del archivo guardado
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Un criador no puede estar registrado dos veces en la misma sociedad,
// pero sí en sociedades de distintas federaciones.
SocioSchema.index({ anilloCriador: 1, sociedadId: 1 }, { unique: true });
// El mismo DNI no puede aparecer dos veces en la misma sociedad.
SocioSchema.index({ dni: 1, sociedadId: 1 }, { unique: true });

SocioSchema.virtual('nombreCompleto').get(function () {
  return `${this.apellido}, ${this.nombre}`;
});

module.exports = mongoose.model('Socio', SocioSchema);
