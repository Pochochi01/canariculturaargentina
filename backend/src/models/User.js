const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES_VALIDOS = ['admin_general', 'admin_sociedad', 'socio', 'operador'];

const UserSchema = new mongoose.Schema({
  dni:          { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  // Campo legacy — se conserva para compatibilidad con documentos anteriores
  role: { type: String, enum: ROLES_VALIDOS },
  // Nuevo campo multi-rol — fuente de verdad cuando tiene elementos
  roles: { type: [{ type: String, enum: ROLES_VALIDOS }], default: [] },
  sociedadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sociedad', default: null },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

// Devuelve el conjunto efectivo de roles:
// prioriza el array 'roles' si tiene elementos, sino usa el campo legacy 'role'.
UserSchema.methods.effectiveRoles = function () {
  if (this.roles && this.roles.length > 0) return [...this.roles];
  if (this.role) return [this.role];
  return [];
};

UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

module.exports = mongoose.model('User', UserSchema);
