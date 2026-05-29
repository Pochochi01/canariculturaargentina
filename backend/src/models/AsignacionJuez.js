const mongoose = require('mongoose');

const AsignacionJuezSchema = new mongoose.Schema({
  competenciaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Competencia',
    required: true
  },
  codigoNomenclador: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  tipoPresentacion: {
    type: String,
    enum: ['individual', 'duos', 'cuartetos', 'todos'],
    required: true
  },
  juecesIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Juez' }]
}, { timestamps: true });

// Un solo registro por combinación competencia + lote + tipoPresentacion
AsignacionJuezSchema.index(
  { competenciaId: 1, codigoNomenclador: 1, tipoPresentacion: 1 },
  { unique: true }
);

module.exports = mongoose.model('AsignacionJuez', AsignacionJuezSchema);
