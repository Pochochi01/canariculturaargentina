const mongoose = require('mongoose');

const CompetenciaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, trim: true },
  sociedadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad',   default: null },
  federacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Federacion', default: null },
  juezId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Juez',       default: null },
  fecha: { type: Date },
  lugar: { type: String, trim: true },
  tipoCompetencia: {
    type: String,
    enum: ['clasica', 'abierto', 'nacional', 'mundial'],
    default: 'clasica'
  },
  maxIndividuales: { type: String, enum: ['libre', '2', '3'], default: 'libre' },
  maxDuos:        { type: String, enum: ['libre', '2', '3'], default: 'libre' },
  maxCuartetos:   { type: String, enum: ['libre', '2', '3'], default: 'libre' },
  estadoInscripcion: {
    type: String,
    enum: ['abierta', 'cerrada', 'juzgada'],
    default: 'abierta'
  },
  estadoCompetencia: {
    type: String,
    enum: ['en_curso', 'finalizada'],
    default: 'en_curso'
  }
}, { timestamps: true });

module.exports = mongoose.model('Competencia', CompetenciaSchema);
