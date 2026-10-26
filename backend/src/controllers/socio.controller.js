const path = require('path');
const Socio = require('../models/Socio');
const User = require('../models/User');
const Sociedad = require('../models/Sociedad');

/**
 * Valida que el anilloCriador no esté registrado en otra sociedad de la misma federación.
 *
 * Regla:
 *  - Un mismo anilloCriador puede existir en varias sociedades de DISTINTAS federaciones.
 *  - No puede existir dos veces en sociedades de la MISMA federación.
 *  - Si la sociedad destino no tiene federación (cadena vacía), la unicidad es solo
 *    dentro de esa misma sociedad (ya cubierta por el índice compuesto del modelo).
 *
 * @param {string} anilloCriador  - Número de anillo a validar (ya en mayúsculas)
 * @param {ObjectId} sociedadId   - Sociedad destino del nuevo/editado socio
 * @param {ObjectId|null} excluirSocioId - ID del socio actual al editar (evita compararse consigo mismo)
 */
const validarAnilloCriadorPorFederacion = async (anilloCriador, sociedadId, excluirSocioId = null) => {
  // Obtener la federación de la sociedad destino
  const sociedadDestino = await Sociedad.findById(sociedadId).select('federacion nombre');
  if (!sociedadDestino) throw new Error('Sociedad no encontrada');

  // Si la sociedad no tiene federación asignada, la validación inter-federación no aplica
  const fedDestino = sociedadDestino.federacion;
  if (!fedDestino) return;

  // Buscar otros socios con el mismo anilloCriador (excluyendo el propio en caso de edición)
  const query = { anilloCriador, sociedadId: { $ne: sociedadId } };
  if (excluirSocioId) query._id = { $ne: excluirSocioId };

  const sociosExistentes = await Socio.find(query).select('sociedadId').lean();
  if (sociosExistentes.length === 0) return;

  // Obtener las federaciones de las sociedades donde ya existe ese anillo
  const sociedadesIds = sociosExistentes.map(s => s.sociedadId);
  const sociedadesConflicto = await Sociedad.find({
    _id: { $in: sociedadesIds },
    federacion: fedDestino
  }).select('nombre federacion').lean();

  if (sociedadesConflicto.length > 0) {
    const nombres = sociedadesConflicto.map(s => s.nombre).join(', ');
    throw Object.assign(
      new Error(`El anillo criador "${anilloCriador}" ya está registrado en la federación ${fedDestino} (sociedad/es: ${nombres})`),
      { status: 409 }
    );
  }
};

/**
 * Valida que el DNI no esté registrado en otra sociedad de la misma federación.
 *
 * Regla:
 *  - Un mismo DNI puede existir en varias sociedades de DISTINTAS federaciones.
 *  - No puede existir en dos sociedades de la MISMA federación.
 *  - Si la sociedad destino no tiene federación asignada, la validación no aplica
 *    (la unicidad dentro de esa sociedad la garantiza el índice compuesto del modelo).
 *
 * @param {string} dni              - DNI a validar
 * @param {ObjectId} sociedadId     - Sociedad destino del nuevo/editado socio
 * @param {ObjectId|null} excluirSocioId - ID del socio actual al editar
 */
const validarDNIPorFederacion = async (dni, sociedadId, excluirSocioId = null) => {
  const sociedadDestino = await Sociedad.findById(sociedadId).select('federacion nombre');
  if (!sociedadDestino) throw new Error('Sociedad no encontrada');

  const fedDestino = sociedadDestino.federacion;
  if (!fedDestino) return; // sin federación, no aplica restricción inter-sociedad

  // Socios con el mismo DNI en otras sociedades
  const query = { dni, sociedadId: { $ne: sociedadId } };
  if (excluirSocioId) query._id = { $ne: excluirSocioId };

  const sociosExistentes = await Socio.find(query).select('sociedadId').lean();
  if (sociosExistentes.length === 0) return;

  // Verificar si alguna de esas sociedades comparte federación con la destino
  const sociedadesIds = sociosExistentes.map(s => s.sociedadId);
  const sociedadesConflicto = await Sociedad.find({
    _id: { $in: sociedadesIds },
    federacion: fedDestino
  }).select('nombre').lean();

  if (sociedadesConflicto.length > 0) {
    const nombres = sociedadesConflicto.map(s => s.nombre).join(', ');
    throw Object.assign(
      new Error(`El DNI "${dni}" ya está registrado en la federación ${fedDestino} (sociedad/es: ${nombres})`),
      { status: 409 }
    );
  }
};

const getSociedadFilter = (user) => {
  if (user.role === 'admin_sociedad') return { sociedadId: user.sociedadId };
  if (user.role === 'socio') return { _id: null }; // socios no listan
  return {};
};

exports.getAll = async (req, res, next) => {
  try {
    const filter = getSociedadFilter(req.user);
    if (req.query.sociedadId && req.user.role === 'admin_general') {
      filter.sociedadId = req.query.sociedadId;
    }
    if (req.query.activo !== undefined) filter.activo = req.query.activo === 'true';

    // Búsqueda por palabras (orden independiente): cada palabra debe estar en
    // alguno de los campos anilloCriador, apellido o nombre.
    if (req.query.q) {
      const words = req.query.q.trim().split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        filter.$and = words.map(word => {
          const rx = new RegExp(word, 'i');
          return { $or: [{ anilloCriador: rx }, { apellido: rx }, { nombre: rx }] };
        });
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [socios, total] = await Promise.all([
      Socio.find(filter)
        .populate('sociedadId', 'nombre codigo')
        .sort({ apellido: 1, nombre: 1 })
        .skip(skip)
        .limit(limit),
      Socio.countDocuments(filter)
    ]);

    res.json({ socios, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const socio = await Socio.findById(req.params.id).populate('sociedadId', 'nombre codigo');
    if (!socio) return res.status(404).json({ error: 'Socio no encontrado' });

    if (req.user.role === 'admin_sociedad' &&
        socio.sociedadId._id.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'Sin acceso a este socio' });
    }
    res.json(socio);
  } catch (err) { next(err); }
};

// GET /socios/verificar?anillo=&dni=&excluirId=&sociedadId=
// Verifica si un anilloCriador o DNI ya están registrados en la misma sociedad.
// excluirId: en modo edición, excluye al socio actual del resultado.
exports.verificarDisponibilidad = async (req, res, next) => {
  try {
    const { anillo, dni, excluirId } = req.query;

    // Determinar la sociedad a verificar
    const sociedadId = req.user.role === 'admin_sociedad'
      ? req.user.sociedadId
      : (req.query.sociedadId || null);

    const excluir = excluirId ? { _id: { $ne: excluirId } } : {};
    const scopeSociedad = sociedadId ? { sociedadId } : {};

    const result = {};

    if (anillo) {
      const found = await Socio.findOne({
        anilloCriador: anillo.trim().toUpperCase(),
        ...scopeSociedad,
        ...excluir
      }).select('apellido nombre').lean();
      result.anillo = {
        existe: !!found,
        nombre: found ? `${found.apellido}, ${found.nombre}` : null
      };
    }

    if (dni) {
      const found = await Socio.findOne({
        dni: dni.trim().replace(/[^0-9]/g, ''),
        ...scopeSociedad,
        ...excluir
      }).select('apellido nombre').lean();
      result.dni = {
        existe: !!found,
        nombre: found ? `${found.apellido}, ${found.nombre}` : null
      };
    }

    res.json(result);
  } catch (err) { next(err); }
};

exports.getByAnillo = async (req, res, next) => {
  try {
    const socio = await Socio.findOne({ anilloCriador: req.params.anillo.toUpperCase() })
      .populate('sociedadId', 'nombre codigo');
    if (!socio) return res.status(404).json({ error: 'Criador no encontrado' });
    res.json(socio);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { apellido, nombre, domicilio, correo, telefono, direccion, sociedadId, crearUsuario } = req.body;

    // Sanitización estricta: sin espacios ni caracteres inválidos
    const anilloCriador = (req.body.anilloCriador || '').replace(/\s/g, '').toUpperCase();
    const dni           = (req.body.dni           || '').replace(/[^0-9]/g, '');

    if (!anilloCriador) return res.status(400).json({ error: 'El Anillo de Criador no puede estar vacío.' });
    if (!dni)           return res.status(400).json({ error: 'El DNI no puede estar vacío y debe contener solo números.' });

    const socSociedadId = req.user.role === 'admin_sociedad' ? req.user.sociedadId : sociedadId;

    await validarAnilloCriadorPorFederacion(anilloCriador, socSociedadId);
    await validarDNIPorFederacion(dni, socSociedadId);

    const socio = await Socio.create({
      anilloCriador, apellido, nombre, dni, domicilio, correo, telefono, direccion,
      sociedadId: socSociedadId
    });

    if (crearUsuario) {
      const passwordHash = await User.hashPassword(dni);
      const user = await User.create({
        dni,
        passwordHash,
        role: 'socio',
        sociedadId: socSociedadId
      });
      socio.userId = user._id;
      await socio.save();
    }

    res.status(201).json(socio);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { apellido, nombre, domicilio, correo, telefono, direccion, activo } = req.body;

    // Sanitización: sin espacios en anillo, solo dígitos en DNI
    const anilloCriador = req.body.anilloCriador !== undefined
      ? (req.body.anilloCriador || '').replace(/\s/g, '').toUpperCase()
      : undefined;
    const dni = req.body.dni !== undefined
      ? (req.body.dni || '').replace(/[^0-9]/g, '')
      : undefined;

    const socio = await Socio.findById(req.params.id);
    if (!socio) return res.status(404).json({ error: 'Socio no encontrado' });

    if (req.user.role === 'admin_sociedad' &&
        socio.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'Sin acceso a este socio' });
    }

    if (req.user.role === 'socio' && socio.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Solo puede editar su propio perfil' });
    }

    // Validar cambio de anilloCriador contra federación solo si el valor cambió
    if (anilloCriador !== undefined) {
      if (!anilloCriador) return res.status(400).json({ error: 'El Anillo de Criador no puede estar vacío.' });
      if (anilloCriador !== socio.anilloCriador)
        await validarAnilloCriadorPorFederacion(anilloCriador, socio.sociedadId, socio._id);
    }

    // Validar cambio de DNI contra federación solo si el valor cambió
    if (dni !== undefined) {
      if (!dni) return res.status(400).json({ error: 'El DNI no puede estar vacío y debe contener solo números.' });
      if (dni !== socio.dni)
        await validarDNIPorFederacion(dni, socio.sociedadId, socio._id);
    }

    Object.assign(socio, {
      ...(anilloCriador !== undefined && { anilloCriador }),
      ...(dni           !== undefined && { dni }),
      apellido, nombre, domicilio, correo, telefono, direccion, activo
    });
    await socio.save();
    res.json(socio);
  } catch (err) { next(err); }
};

/** El socio ve y edita su propio perfil */
exports.getMe = async (req, res, next) => {
  try {
    const socio = await Socio.findOne({ userId: req.user._id })
      .populate('sociedadId', 'nombre codigo federacion');
    if (!socio) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(socio);
  } catch (err) { next(err); }
};

exports.updateMe = async (req, res, next) => {
  try {
    const socio = await Socio.findOne({ userId: req.user._id });
    if (!socio) return res.status(404).json({ error: 'Perfil no encontrado' });

    const { nombre, apellido, telefono, correo, domicilio, direccion } = req.body;
    Object.assign(socio, { nombre, apellido, telefono, correo, domicilio, direccion });
    await socio.save();
    res.json(socio);
  } catch (err) { next(err); }
};

exports.uploadFoto = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen' });

    const socio = await Socio.findOne({ userId: req.user._id });
    if (!socio) return res.status(404).json({ error: 'Perfil no encontrado' });

    socio.fotoPerfil = req.file.filename;
    await socio.save();
    res.json({ fotoPerfil: req.file.filename });
  } catch (err) { next(err); }
};

exports.crearUsuario = async (req, res, next) => {
  try {
    const socio = await Socio.findById(req.params.id);
    if (!socio) return res.status(404).json({ error: 'Socio no encontrado' });

    if (req.user.role === 'admin_sociedad' &&
        socio.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'Sin acceso a este socio' });
    }

    if (socio.userId) return res.status(409).json({ error: 'El socio ya tiene usuario creado' });

    const existe = await User.findOne({ dni: socio.dni });
    if (existe) {
      // Reutilizar usuario existente si no tiene sociedad asignada
      existe.addRole('socio');
      existe.sociedadId = socio.sociedadId;
      await existe.save();
      socio.userId = existe._id;
      await socio.save();
      return res.json({ message: 'Usuario existente vinculado al socio', userId: existe._id });
    }

    const passwordHash = await User.hashPassword(socio.dni);
    const user = await User.create({
      dni: socio.dni,
      passwordHash,
      role: 'socio',
      sociedadId: socio.sociedadId
    });
    socio.userId = user._id;
    await socio.save();
    res.status(201).json({ message: 'Usuario creado correctamente', userId: user._id });
  } catch (err) { next(err); }
};

exports.resetearClave = async (req, res, next) => {
  try {
    const socio = await Socio.findById(req.params.id);
    if (!socio) return res.status(404).json({ error: 'Socio no encontrado' });

    if (req.user.role === 'admin_sociedad' &&
        socio.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'Sin acceso a este socio' });
    }

    if (!socio.userId) return res.status(404).json({ error: 'El socio no tiene usuario creado' });

    const user = await User.findById(socio.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.passwordHash = await User.hashPassword(socio.dni);
    await user.save();
    res.json({ message: 'Contraseña reiniciada al DNI del socio' });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const socio = await Socio.findById(req.params.id);
    if (!socio) return res.status(404).json({ error: 'Socio no encontrado' });

    if (req.user.role === 'admin_sociedad' &&
        socio.sociedadId.toString() !== req.user.sociedadId.toString()) {
      return res.status(403).json({ error: 'Sin acceso a este socio' });
    }

    socio.activo = false;
    await socio.save();
    res.json({ message: 'Socio desactivado correctamente' });
  } catch (err) { next(err); }
};
