const mongoose = require('mongoose');

const ACCIONES = [
  'CREAR_DUO',
  'DESARMAR_DUO',
  'CREAR_CUARTETO',
  'DESARMAR_CUARTETO',
  'TRANSFORMAR_DUO_CUARTETO',
  'CONVERTIR_A_INDIVIDUAL',
  'PROMOVER_SUPLENTE',
  'ELIMINAR_INDIVIDUAL',
  'ELIMINAR_COMPOSICION',
  'ENVIAR_AL_NACIONAL'
];

// Registro inmutable de cada cambio de composición (individual / dúo / cuarteto)
const AuditoriaComposicionSchema = new mongoose.Schema({
  fecha:         { type: Date, default: Date.now },
  usuarioId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usuarioDni:    { type: String },
  rol:           { type: String },
  sociedadId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', default: null },
  competenciaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competencia', required: true },
  socioId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Socio', default: null },
  accion:        { type: String, enum: ACCIONES, required: true },
  estadoAnterior: { type: mongoose.Schema.Types.Mixed, default: null },
  estadoNuevo:    { type: mongoose.Schema.Types.Mixed, default: null },
  detalle:       { type: String, default: '' }
}, { versionKey: false });

AuditoriaComposicionSchema.index({ competenciaId: 1, fecha: -1 });

module.exports = mongoose.model('AuditoriaComposicion', AuditoriaComposicionSchema);
module.exports.ACCIONES = ACCIONES;
