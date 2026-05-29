const mongoose = require('mongoose');
const { Schema } = mongoose;

const RevistaSchema = new Schema({
  nombre:        { type: String, required: true, trim: true },
  competenciaId: { type: Schema.Types.ObjectId, ref: 'Competencia', default: null },
  año:           { type: Number },
  filename:      { type: String, required: true },   // nombre del archivo PDF en uploads/revistas/
  token:         { type: String, required: true, unique: true }, // token para link público
  fecha:         { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Revista', RevistaSchema);
