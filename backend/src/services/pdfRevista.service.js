/**
 * pdfRevista.service.js
 * Genera el PDF de revista digital para una competencia.
 *
 * Estructura del PDF:
 *   p.1          → Cover
 *   p.2..N-1     → Grades (primera mitad) + Fullpages (peers=par, odd=impar)
 *                  + Páginas mixtas (half/quarter combos)
 *                  + Catálogo (centro)
 *                  + Grades (segunda mitad)
 *   p.N (última) → Backcover
 */

const path = require('path');
const fs   = require('fs');
const PDFDocument    = require('pdfkit');
const { PDFDocument: LibPDF } = require('pdf-lib');
const Publicidad     = require('../models/Publicidad');
const Competencia    = require('../models/Competencia');
const pdfService     = require('./pdf.service');

const ADS_ROOT = path.join(__dirname, '../../uploads/advertisements');

// A4 sin márgenes (puntos pt)
const PW       = 595.28;
const PH       = 841.89;
const HALF_H   = PH / 2;      // 420.945
const QUARTER_W = PW / 2;     // 297.64

// ── Helpers de imagen ─────────────────────────────────────────────────────────

function adFilePath(pub) {
  if (!pub) return null;
  const p = path.join(ADS_ROOT, pub.filename);
  return fs.existsSync(p) ? p : null;
}

/**
 * Dibuja una imagen o un rectángulo gris si no existe.
 * Siempre cubre exactamente el área (w × h) sin respetar relación de aspecto.
 */
function drawImage(doc, imgPath, x, y, w, h) {
  if (imgPath && fs.existsSync(imgPath)) {
    doc.image(imgPath, x, y, { width: w, height: h });
  } else {
    doc.save()
       .rect(x, y, w, h).fill('#d0d0d0')
       .restore();
  }
}

// ── Construcción de páginas mixtas (half + quarter) ───────────────────────────

/**
 * Empaqueta las imágenes half y quarter en páginas completas usando
 * los cuatro layouts posibles:
 *
 *  A) top: 1 halfpage  | bottom: 2 quarterpages
 *  B) top: 2 quarterpages | bottom: 1 halfpage
 *  C) 4 quarterpages en cuadrícula 2×2
 *  D) 2 halfpages apiladas verticalmente
 */
function buildMixedPages(halves, quarters) {
  const h = [...halves];
  const q = [...quarters];
  const pages = [];

  while (h.length > 0 || q.length > 0) {
    if (h.length >= 2) {
      pages.push({ layout: 'D', h: [h.shift(), h.shift()], q: [] });
    } else if (h.length === 1 && q.length >= 2) {
      const half = h.shift();
      const layout = pages.length % 2 === 0 ? 'A' : 'B';
      pages.push({ layout, h: [half], q: [q.shift(), q.shift()] });
    } else if (q.length >= 4) {
      pages.push({ layout: 'C', h: [], q: [q.shift(), q.shift(), q.shift(), q.shift()] });
    } else if (h.length === 1) {
      // Media página sola (parte inferior vacía)
      pages.push({ layout: 'D', h: [h.shift(), null], q: [] });
    } else if (q.length > 0) {
      // Menos de 4 quarters — completa con null
      const qq = [q.shift(), q.shift() || null, q.shift() || null, q.shift() || null];
      pages.push({ layout: 'C', h: [], q: qq });
    } else {
      break;
    }
  }
  return pages;
}

function drawMixedPage(doc, page) {
  const { layout, h, q } = page;

  if (layout === 'A') {
    // Fila superior: media página
    drawImage(doc, h[0] ? adFilePath(h[0]) : null, 0, 0, PW, HALF_H);
    // Fila inferior: 2 cuartos
    drawImage(doc, q[0] ? adFilePath(q[0]) : null, 0,         HALF_H, QUARTER_W, HALF_H);
    drawImage(doc, q[1] ? adFilePath(q[1]) : null, QUARTER_W, HALF_H, QUARTER_W, HALF_H);

  } else if (layout === 'B') {
    // Fila superior: 2 cuartos
    drawImage(doc, q[0] ? adFilePath(q[0]) : null, 0,         0, QUARTER_W, HALF_H);
    drawImage(doc, q[1] ? adFilePath(q[1]) : null, QUARTER_W, 0, QUARTER_W, HALF_H);
    // Fila inferior: media página
    drawImage(doc, h[0] ? adFilePath(h[0]) : null, 0, HALF_H, PW, HALF_H);

  } else if (layout === 'C') {
    // Cuadrícula 2×2
    drawImage(doc, q[0] ? adFilePath(q[0]) : null, 0,         0,      QUARTER_W, HALF_H);
    drawImage(doc, q[1] ? adFilePath(q[1]) : null, QUARTER_W, 0,      QUARTER_W, HALF_H);
    drawImage(doc, q[2] ? adFilePath(q[2]) : null, 0,         HALF_H, QUARTER_W, HALF_H);
    drawImage(doc, q[3] ? adFilePath(q[3]) : null, QUARTER_W, HALF_H, QUARTER_W, HALF_H);

  } else {
    // D: dos medias páginas apiladas
    drawImage(doc, h[0] ? adFilePath(h[0]) : null, 0, 0,      PW, HALF_H);
    drawImage(doc, h[1] ? adFilePath(h[1]) : null, 0, HALF_H, PW, HALF_H);
  }
}

// ── Generación del PDF de publicidades ───────────────────────────────────────

const A4_OPTS = { size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } };

function buildAdsPDF(sections) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const section of sections) {
      doc.addPage(A4_OPTS);
      section(doc);
    }

    doc.end();
  });
}

// ── Ensamblado principal ──────────────────────────────────────────────────────

async function generarRevistaPDF(competenciaId, res) {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId', 'nombre')
    .lean();
  if (!competencia) throw new Error('Competencia no encontrada');

  // Cargar todas las publicidades ordenadas
  const all = await Publicidad.find({ competenciaId }).sort({ tipo: 1, subtipo: 1, orden: 1 });

  const cover     = all.find(a => a.tipo === 'cover')     || null;
  const backcover = all.find(a => a.tipo === 'backcover') || null;
  const fpPeers   = all.filter(a => a.tipo === 'fullpage' && a.subtipo === 'peers');
  const fpOdd     = all.filter(a => a.tipo === 'fullpage' && a.subtipo === 'odd');
  const halves    = all.filter(a => a.tipo === 'halfpage');
  const quarters  = all.filter(a => a.tipo === 'quarterpage');
  const grades    = all.filter(a => a.tipo === 'grades');

  const mixedPages   = buildMixedPages(halves, quarters);
  const gradesBefore = grades.slice(0, Math.ceil(grades.length / 2));
  const gradesAfter  = grades.slice(Math.ceil(grades.length / 2));

  // ── Construir la secuencia de páginas pre-catálogo ────────────────────────
  // Página 1 = cover (impar). Las siguientes se numeran desde 2.
  // Peers → páginas pares | Odd → páginas impares.

  const preSections  = []; // funciones (doc) => void para páginas pre-catálogo
  const postSections = []; // funciones (doc) => void para páginas post-catálogo

  // Cover
  preSections.push(doc => drawImage(doc, adFilePath(cover), 0, 0, PW, PH));

  // Grades antes del catálogo
  for (const g of gradesBefore) {
    preSections.push(doc => drawImage(doc, adFilePath(g), 0, 0, PW, PH));
  }

  // Fullpages intercalados: peers en páginas pares, odd en impares.
  // El número de página en el PDF final = preSections.length + 1 al insertar.
  const peersQ = [...fpPeers];
  const oddQ   = [...fpOdd];
  while (peersQ.length > 0 || oddQ.length > 0) {
    // Página que se va a insertar (base-1 en el PDF final)
    const pageNum = preSections.length + 1;
    const isEven  = pageNum % 2 === 0;
    let pub;
    if (isEven  && peersQ.length > 0) pub = peersQ.shift();
    else if (!isEven && oddQ.length  > 0) pub = oddQ.shift();
    else if (peersQ.length > 0)           pub = peersQ.shift();
    else                                  pub = oddQ.shift();

    const captured = pub;
    preSections.push(doc => drawImage(doc, adFilePath(captured), 0, 0, PW, PH));
  }

  // Páginas mixtas (half / quarter)
  for (const mp of mixedPages) {
    const captured = mp;
    preSections.push(doc => drawMixedPage(doc, captured));
  }

  // Grades después del catálogo
  for (const g of gradesAfter) {
    postSections.push(doc => drawImage(doc, adFilePath(g), 0, 0, PW, PH));
  }

  // Backcover (última página)
  postSections.push(doc => drawImage(doc, adFilePath(backcover), 0, 0, PW, PH));

  // ── Generar buffers ───────────────────────────────────────────────────────
  const [preBuffer, catalogBuffer, postBuffer] = await Promise.all([
    buildAdsPDF(preSections),
    pdfService.generarCatalogoBuffer(competenciaId),
    buildAdsPDF(postSections)
  ]);

  // ── Fusionar con pdf-lib ──────────────────────────────────────────────────
  const [prePdf, catalogPdf, postPdf] = await Promise.all([
    LibPDF.load(preBuffer),
    LibPDF.load(catalogBuffer),
    LibPDF.load(postBuffer)
  ]);

  const merged = await LibPDF.create();

  const copyAll = async (src) => {
    const indices = Array.from({ length: src.getPageCount() }, (_, i) => i);
    if (indices.length === 0) return;
    const pages = await merged.copyPages(src, indices);
    pages.forEach(p => merged.addPage(p));
  };

  await copyAll(prePdf);
  await copyAll(catalogPdf);
  await copyAll(postPdf);

  const mergedBytes = await merged.save();

  const nombre = competencia.nombre?.replace(/[^a-z0-9]/gi, '_') || competenciaId;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="revista_${nombre}.pdf"`);
  res.end(Buffer.from(mergedBytes));
}

module.exports = { generarRevistaPDF };
