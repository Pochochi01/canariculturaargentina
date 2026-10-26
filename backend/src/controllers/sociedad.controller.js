const Sociedad = require('../models/Sociedad');
const User = require('../models/User');
const Socio = require('../models/Socio');
const Competencia = require('../models/Competencia');
const MovimientoSociedad = require('../models/MovimientoSociedad');
const PagoCuota = require('../models/PagoCuota');
const ConfigCuota = require('../models/ConfigCuota');
const Ejemplar = require('../models/Ejemplar');
const Pareja = require('../models/Pareja');
const Puesta = require('../models/Puesta');
const Notificacion = require('../models/Notificacion');
const Inscripcion = require('../models/Inscripcion');
const Mesa = require('../models/Mesa');
const AsignacionJuez = require('../models/AsignacionJuez');
const NomencladorCompetencia = require('../models/NomencladorCompetencia');
const Publicidad = require('../models/Publicidad');
const Revista = require('../models/Revista');

// Siglas sin puntos ni espacios, en mayúsculas
const normalizarCodigo = (c) => String(c || '').replace(/[\s.]/g, '').toUpperCase();

exports.getAll = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.activa !== undefined) filter.activa = req.query.activa === 'true';
    const sociedades = await Sociedad.find(filter)
      .populate('adminId', 'dni role')
      .sort({ nombre: 1 });
    res.json(sociedades);
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id).populate('adminId', 'dni role');
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });
    res.json(sociedad);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, provincia, direccion, telefono, mail, federacion } = req.body;
    const codigo = normalizarCodigo(req.body.codigo);
    const sociedad = await Sociedad.create({ codigo, nombre, provincia, direccion, telefono, mail, federacion });
    res.status(201).json(sociedad);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });

    const campos = ['codigo', 'nombre', 'provincia', 'direccion', 'telefono', 'mail', 'activa'];
    for (const c of campos) {
      if (req.body[c] !== undefined) sociedad[c] = req.body[c];
    }

    // federacion se normaliza a mayúsculas; cadena vacía = sin federación
    const fedRaw = req.body.federacion;
    if (fedRaw !== undefined) {
      sociedad.federacion = typeof fedRaw === 'string' ? fedRaw.trim().toUpperCase() : '';
    }

    if (req.body.codigo !== undefined) sociedad.codigo = normalizarCodigo(req.body.codigo);

    await sociedad.save();
    res.json(sociedad);
  } catch (err) { next(err); }
};

const contarRelacionados = async (id) => {
  const [socios, competencias, movimientos, pagos] = await Promise.all([
    Socio.countDocuments({ sociedadId: id }),
    Competencia.countDocuments({ sociedadId: id }),
    MovimientoSociedad.countDocuments({ sociedadId: id }),
    PagoCuota.countDocuments({ sociedadId: id })
  ]);
  return { socios, competencias, movimientos, pagos };
};

exports.resumenEliminacion = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });
    res.json(await contarRelacionados(sociedad._id));
  } catch (err) { next(err); }
};

// Borrado definitivo en cascada: socios (y sus ejemplares, parejas, puestas, etc.),
// competencias (y sus inscripciones, mesas, etc.), movimientos, pagos y cuotas.
exports.remove = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });

    const id = sociedad._id;
    const socioIds = await Socio.find({ sociedadId: id }).distinct('_id');
    const competenciaIds = await Competencia.find({ sociedadId: id }).distinct('_id');
    const porSocio = { socioId: { $in: socioIds } };
    const porCompetencia = { competenciaId: { $in: competenciaIds } };

    await Promise.all([
      Ejemplar.deleteMany(porSocio),
      Pareja.deleteMany(porSocio),
      Puesta.deleteMany(porSocio),
      Notificacion.deleteMany(porSocio),
      Inscripcion.deleteMany({ $or: [porSocio, porCompetencia] }),
      Mesa.deleteMany(porCompetencia),
      AsignacionJuez.deleteMany(porCompetencia),
      NomencladorCompetencia.deleteMany(porCompetencia),
      Publicidad.deleteMany(porCompetencia),
      Revista.deleteMany(porCompetencia),
      PagoCuota.deleteMany({ $or: [{ sociedadId: id }, porSocio] }),
      MovimientoSociedad.deleteMany({ sociedadId: id }),
      ConfigCuota.deleteMany({ sociedadId: id })
    ]);
    await Promise.all([
      Socio.deleteMany({ sociedadId: id }),
      Competencia.deleteMany({ sociedadId: id }),
      User.updateMany({ sociedadId: id }, { $set: { sociedadId: null } })
    ]);
    await sociedad.deleteOne();
    res.json({ message: 'Sociedad eliminada definitivamente' });
  } catch (err) { next(err); }
};

exports.toggleActiva = async (req, res, next) => {
  try {
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });
    sociedad.activa = !sociedad.activa;
    await sociedad.save();
    res.json(sociedad);
  } catch (err) { next(err); }
};

exports.asignarAdmin = async (req, res, next) => {
  try {
    const { dni, password } = req.body;
    const sociedad = await Sociedad.findById(req.params.id);
    if (!sociedad) return res.status(404).json({ error: 'Sociedad no encontrada' });

    let adminUser = await User.findOne({ dni });
    if (!adminUser) {
      const passwordHash = await User.hashPassword(password || dni);
      adminUser = await User.create({
        dni,
        passwordHash,
        role: 'admin_sociedad',
        sociedadId: sociedad._id
      });
    } else {
      adminUser.role = 'admin_sociedad';
      adminUser.sociedadId = sociedad._id;
      await adminUser.save();
    }

    sociedad.adminId = adminUser._id;
    await sociedad.save();
    res.json({ message: 'Administrador asignado', adminId: adminUser._id });
  } catch (err) { next(err); }
};
