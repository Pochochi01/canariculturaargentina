const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  dni: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin_general', 'admin_sociedad', 'socio', 'operador'],
    required: true
  },
  sociedadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', default: null },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', UserSchema);
