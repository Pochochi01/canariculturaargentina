const mongoose = require('mongoose');

const PremioSchema = new mongoose.Schema({
  tipo: { type: String, trim: true },
  descripcion: { type: String, trim: true }
}, { _id: false });

const InscripcionSchema = new mongoose.Schema({
  competenciaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competencia', required: true },
  numCriador: { type: String, required: true, trim: true, uppercase: true },
  socioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Socio', default: null },
  tipoNomenclador: { type: String, enum: ['color', 'forma'], required: true },
  codigoNomenclador: { type: String, required: true, trim: true, uppercase: true },
  nombreNomenclador: { type: String, trim: true },
  tipoPresentacion: {
    type: String,
    enum: ['individual', 'duos', 'cuartetos'],
    default: 'individual'
  },
  // Identificador compartido para todos los registros del mismo dúo/cuarteto
  grupoPresentacion: { type: String, default: null },
  // Anillo único de este registro
  numAnillo: { type: String, required: true, trim: true, uppercase: true },
  // Solo true para el suplente opcional del cuarteto
  esSuplente: { type: Boolean, default: false },
  // Año de nacimiento del canario (año del anillo, debe ser el año anterior a la competencia)
  anioAnillo: { type: Number, default: null },
  lote: { type: String, trim: true, uppercase: true },
  numJaula: { type: Number, default: null },
  puntaje: { type: Number, default: null, min: 0, max: 100 },
  premios: { type: [PremioSchema], default: [] },
  observaciones: { type: String, trim: true }
}, { timestamps: true });

// Un mismo socio no puede repetir el mismo anillo en la misma competencia.
// Distintos socios SÍ pueden usar el mismo número de anillo en la misma competencia.
// sparse:true porque socioId puede ser null en registros legacy.
InscripcionSchema.index(
  { competenciaId: 1, socioId: 1, numAnillo: 1 },
  { unique: true, sparse: true }
);
InscripcionSchema.index({ competenciaId: 1, lote: 1 });
InscripcionSchema.index({ numCriador: 1, competenciaId: 1 });
InscripcionSchema.index({ competenciaId: 1, numJaula: 1 });
InscripcionSchema.index({ grupoPresentacion: 1 });

InscripcionSchema.pre('save', function (next) {
  if (!this.lote) this.lote = this.codigoNomenclador;
  next();
});

module.exports = mongoose.model('Inscripcion', InscripcionSchema);
