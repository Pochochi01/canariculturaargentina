const mongoose = require('mongoose');

const EjemplarSchema = new mongoose.Schema({
  socioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Socio', required: true },
  numAnillo: { type: String, required: true, trim: true, uppercase: true },
  sexo: { type: String, enum: ['macho', 'hembra', 'desconocido'], required: true },
  tipoCanario: { type: String, enum: ['color', 'forma', 'canto'], required: true },
  codigoNomenclador: { type: String, trim: true, uppercase: true, default: '' },
  nombreNomenclador: { type: String, trim: true, default: '' },
  fechaNacimiento: { type: Date, default: null },
  fechaAnillado: { type: Date, default: null },
  estado: {
    type: String,
    enum: ['disponible', 'en_venta', 'vendido', 'muerto', 'intercambiado', 'perdido', 'donado', 'otro'],
    default: 'disponible'
  },
  temporadaAnillado: { type: Number, default: null },
  procedencia: { type: String, trim: true, uppercase: true, default: '' },
  procedenciaTipo: { type: String, enum: ['propio', 'adquirido'], default: 'propio' },
  procedenciaApellido: { type: String, trim: true, default: '' },
  procedenciaNombre: { type: String, trim: true, default: '' },
  jaula: { type: String, trim: true, default: '' },
  observaciones: { type: String, trim: true, default: '' },
  // Referencia a la puesta de la que nació (opcional)
  puestaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Puesta', default: null },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Un socio no puede tener dos veces el mismo anillo
EjemplarSchema.index({ socioId: 1, numAnillo: 1 }, { unique: true });

// La combinación anillo + temporada + procedencia debe ser única globalmente
EjemplarSchema.index(
  { numAnillo: 1, temporadaAnillado: 1, procedencia: 1 },
  {
    unique: true,
    partialFilterExpression: {
      numAnillo:        { $type: 'string' },
      temporadaAnillado:{ $type: 'number' },
      procedencia:      { $type: 'string' }
    }
  }
);

module.exports = mongoose.model('Ejemplar', EjemplarSchema);
