const Premio = require('../models/Premio');

// Valores por defecto que se usan si no hay config en DB.
// Los tipos DEBEN coincidir exactamente con los almacenados en premios de Inscripcion
// (definidos en JuraPage: 'GCA', 'CA', 'RC', '1°'–'10°').
const DEFAULTS = {
  GCA:  { label: 'Gran Campeón Argentino', puntosIndividual: 30, puntosDuos: 25, puntosCuartetos: 20, orden: 0  },
  CA:   { label: 'Campeón Argentino',      puntosIndividual: 25, puntosDuos: 20, puntosCuartetos: 15, orden: 1  },
  RC:   { label: 'Reservado Campeón',       puntosIndividual: 20, puntosDuos: 15, puntosCuartetos: 12, orden: 2  },
  '1°': { label: 'Mención 1°',            puntosIndividual: 18, puntosDuos: 14, puntosCuartetos: 10, orden: 3  },
  '2°': { label: 'Mención 2°',            puntosIndividual: 16, puntosDuos: 12, puntosCuartetos: 9,  orden: 4  },
  '3°': { label: 'Mención 3°',            puntosIndividual: 14, puntosDuos: 10, puntosCuartetos: 8,  orden: 5  },
  '4°': { label: 'Mención 4°',            puntosIndividual: 12, puntosDuos: 9,  puntosCuartetos: 7,  orden: 6  },
  '5°': { label: 'Mención 5°',            puntosIndividual: 10, puntosDuos: 8,  puntosCuartetos: 6,  orden: 7  },
  '6°': { label: 'Mención 6°',            puntosIndividual: 9,  puntosDuos: 7,  puntosCuartetos: 5,  orden: 8  },
  '7°': { label: 'Mención 7°',            puntosIndividual: 8,  puntosDuos: 6,  puntosCuartetos: 5,  orden: 9  },
  '8°': { label: 'Mención 8°',            puntosIndividual: 7,  puntosDuos: 5,  puntosCuartetos: 4,  orden: 10 },
  '9°': { label: 'Mención 9°',            puntosIndividual: 6,  puntosDuos: 4,  puntosCuartetos: 3,  orden: 11 },
  '10°':{ label: 'Mención 10°',           puntosIndividual: 5,  puntosDuos: 3,  puntosCuartetos: 2,  orden: 12 },
};

exports.DEFAULTS = DEFAULTS;

// Siempre devuelve la lista completa: para cada tipo en DEFAULTS usa el valor de DB
// si existe, o el valor por defecto si no. Así la tabla nunca pierde filas aunque
// solo algunos tipos hayan sido guardados en la colección.
exports.getAll = async (req, res, next) => {
  try {
    const dbPremios = await Premio.find().lean();
    const dbMap = new Map(dbPremios.map(p => [p.tipo, p]));

    const items = Object.entries(DEFAULTS).map(([tipo, def]) => {
      const db = dbMap.get(tipo);
      if (db) return db;
      // Tipo aún no persistido → devolver con _id null para indicar "no guardado"
      return { _id: null, tipo, ...def };
    });

    res.json(items);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { puntosIndividual, puntosDuos, puntosCuartetos, label } = req.body;
    const { tipo } = req.params;

    const def = DEFAULTS[tipo];
    if (!def) return res.status(400).json({ error: 'Tipo de premio inválido' });

    const update = {
      label:            label            !== undefined ? label            : def.label,
      puntosIndividual: puntosIndividual !== undefined ? Math.max(0, Math.round(Number(puntosIndividual))) : def.puntosIndividual,
      puntosDuos:       puntosDuos       !== undefined ? Math.max(0, Math.round(Number(puntosDuos)))       : def.puntosDuos,
      puntosCuartetos:  puntosCuartetos  !== undefined ? Math.max(0, Math.round(Number(puntosCuartetos)))  : def.puntosCuartetos,
      orden:            def.orden,
    };

    const premio = await Premio.findOneAndUpdate(
      { tipo },
      { $set: update },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json(premio);
  } catch (err) { next(err); }
};

// Upsert idempotente: aplica los valores por defecto sobre TODOS los tipos,
// sin importar si ya existen registros previos en la colección.
exports.inicializar = async (req, res, next) => {
  try {
    const ops = Object.entries(DEFAULTS).map(([tipo, d]) => ({
      updateOne: {
        filter: { tipo },
        update: { $set: { tipo, ...d } },
        upsert: true,
      }
    }));
    await Premio.bulkWrite(ops);
    res.json({ message: 'Valores por defecto cargados', count: ops.length });
  } catch (err) { next(err); }
};
