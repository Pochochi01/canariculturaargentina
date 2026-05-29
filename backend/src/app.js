const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const sociedadRoutes = require('./routes/sociedad.routes');
const socioRoutes = require('./routes/socio.routes');
const juezRoutes = require('./routes/juez.routes');
const nomencladorRoutes = require('./routes/nomenclador.routes');
const competenciaRoutes = require('./routes/competencia.routes');
const inscripcionRoutes = require('./routes/inscripcion.routes');
const mesaRoutes = require('./routes/mesa.routes');
const pdfRoutes = require('./routes/pdf.routes');
const ejemplarRoutes = require('./routes/ejemplar.routes');
const parejaRoutes = require('./routes/pareja.routes');
const puestaRoutes = require('./routes/puesta.routes');
const premioRoutes        = require('./routes/premio.routes');
const dropdownRoutes      = require('./routes/dropdown.routes');
const asignacionJuezRoutes = require('./routes/asignacionJuez.routes');
const gestionRoutes        = require('./routes/gestion.routes');
const publicidadRoutes               = require('./routes/publicidad.routes');
const revistaRoutes                  = require('./routes/revista.routes');
const nomencladorCompetenciaRoutes   = require('./routes/nomencladorCompetencia.routes');
const csvToPdfRoutes                 = require('./routes/csvToPdf.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

// Permite uno o varios orígenes separados por coma en FRONTEND_URL
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Sin origen (peticiones server-to-server, Nginx mismo) o en la lista → OK
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/logos',   express.static(path.join(__dirname, '../uploads/logos')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiados intentos de login. Intente en 15 minutos.' }
});

app.use('/api/auth/login', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/sociedades', sociedadRoutes);
app.use('/api/socios', socioRoutes);
app.use('/api/jueces', juezRoutes);
app.use('/api/nomencladores', nomencladorRoutes);
app.use('/api/competencias', competenciaRoutes);
app.use('/api/inscripciones', inscripcionRoutes);
app.use('/api/mesas', mesaRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/ejemplares', ejemplarRoutes);
app.use('/api/parejas', parejaRoutes);
app.use('/api/puestas', puestaRoutes);
app.use('/api/premios',           premioRoutes);
app.use('/api/dropdowns',         dropdownRoutes);
app.use('/api/asignaciones-juez', asignacionJuezRoutes);
app.use('/api/gestion',          gestionRoutes);
app.use('/api/publicidades',              publicidadRoutes);
app.use('/api/revistas',                 revistaRoutes);
app.use('/api/nomenclador-competencia',  nomencladorCompetenciaRoutes);
app.use('/api/csv-to-pdf',              csvToPdfRoutes);
app.use('/revistas',             express.static(path.join(__dirname, '../uploads/revistas')));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use(errorHandler);

module.exports = app;
