const mongoose = require('mongoose');

const LoteMesaSchema = new mongoose.Schema({
  codigoNomenclador: { type: String, required: true, trim: true, uppercase: true },
  nombreNomenclador: { type: String, trim: true },
  tipoNomenclador: { type: String, enum: ['color', 'forma'] },
  tipoPresentacion: { type: String, enum: ['individual', 'duos', 'cuartetos', 'todos'], default: 'todos' }
}, { _id: false });

const MesaSchema = new mongoose.Schema({
  competenciaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competencia', required: true },
  numero: { type: Number, required: true },
  juecesIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Juez' }], default: [] },
  lotes: { type: [LoteMesaSchema], default: [] },
  operadorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Rango de jaulas preasignado al operador
  jaulaDesde: { type: Number, default: null },
  jaulaHasta: { type: Number, default: null },
  // Estado por lote: Map<loteKey, 'abierto'|'cerrado'|'jurado'>
  // loteKey = "<codigoNomenclador> - <TIPO_PRESENTACION>"
  estadoLotes: { type: Map, of: String, default: () => new Map() }
}, { timestamps: true });

MesaSchema.index({ competenciaId: 1, numero: 1 }, { unique: true });

module.exports = mongoose.model('Mesa', MesaSchema);
