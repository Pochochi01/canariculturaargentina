const PDFDocument = require('pdfkit');
const Inscripcion = require('../models/Inscripcion');
const Competencia = require('../models/Competencia');
const Sociedad    = require('../models/Sociedad');
const Socio       = require('../models/Socio');
const Juez        = require('../models/Juez');
const Mesa        = require('../models/Mesa');
const AsignacionJuez = require('../models/AsignacionJuez');

const COLORS = {
  primary: '#1e3a5f',
  secondary: '#2563eb',
  accent: '#f59e0b',
  light: '#f1f5f9',
  border: '#cbd5e1',
  text: '#1e293b',
  muted: '#64748b'
};

const FONTS = {
  normal: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique'
};

async function getCompetenciaData(competenciaId) {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId')
    .populate('juezId');
  if (!competencia) throw new Error('Competencia no encontrada');

  const inscripcionesPorLote = await Inscripcion.aggregate([
    { $match: { competenciaId: competencia._id } },
    { $sort: { lote: 1, numCriador: 1, numAnillo: 1 } },
    {
      $group: {
        _id: '$lote',
        nombreNomenclador: { $first: '$nombreNomenclador' },
        tipoNomenclador: { $first: '$tipoNomenclador' },
        items: { $push: '$$ROOT' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return { competencia, inscripcionesPorLote };
}

// ─── Encabezado principal (primera página) ───────────────────────────────────
function drawHeader(doc, competencia, titulo) {
  const pageWidth = doc.page.width;
  const margin = 40;

  doc.rect(0, 0, pageWidth, 100).fill(COLORS.primary);
  doc.fillColor('white').font(FONTS.bold).fontSize(18)
    .text('FEDERACIÓN ARGENTINA DE CANARICULTURA', margin, 18, { align: 'center', width: pageWidth - margin * 2 });
  doc.fontSize(14)
    .text(titulo.toUpperCase(), margin, 42, { align: 'center', width: pageWidth - margin * 2 });
  doc.font(FONTS.normal).fontSize(9)
    .text(competencia.sociedadId?.nombre || '', margin, 64, { align: 'center', width: pageWidth - margin * 2 });

  const fecha = competencia.fecha
    ? new Date(competencia.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  doc.text(`Fecha: ${fecha}   Lugar: ${competencia.lugar || ''}`, margin, 78, {
    align: 'center', width: pageWidth - margin * 2
  });

  doc.rect(0, 100, pageWidth, 4).fill(COLORS.accent);
  return 115;
}

// ─── Encabezado compacto para páginas de continuación ───────────────────────
function drawCompactHeader(doc, competencia, titulo) {
  const pw = doc.page.width;
  doc.rect(0, 0, pw, 38).fill(COLORS.primary);
  doc.fillColor('white').font(FONTS.bold).fontSize(10)
    .text(titulo, 40, 6, { align: 'center', width: pw - 80 });
  const fecha = competencia.fecha
    ? new Date(competencia.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
  doc.font(FONTS.normal).fontSize(7)
    .text(
      `${competencia.sociedadId?.nombre || ''}  ·  ${fecha}  ·  ${competencia.lugar || ''}`,
      40, 22, { align: 'center', width: pw - 80 }
    );
  doc.rect(0, 38, pw, 3).fill(COLORS.accent);
  return 48;
}

// sinJuez=true → solo muestra la caja de Sociedad Organizadora a ancho completo
function drawInfoBlock(doc, competencia, startY, sinJuez = false) {
  const margin = 40;
  const pageWidth = doc.page.width;

  if (sinJuez) {
    const fullW = pageWidth - margin * 2;
    doc.rect(margin, startY, fullW, 50).fill(COLORS.light).stroke(COLORS.border);
    doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(8)
      .text('SOCIEDAD ORGANIZADORA', margin + 6, startY + 6);
    doc.font(FONTS.normal).fontSize(9)
      .text(competencia.sociedadId?.nombre || '-', margin + 6, startY + 18, { width: fullW - 12 });
    doc.fontSize(8).fillColor(COLORS.muted)
      .text(`Provincia: ${competencia.sociedadId?.provincia || '-'}   Tel: ${competencia.sociedadId?.telefono || '-'}`,
        margin + 6, startY + 32, { width: fullW - 12 });
    return startY + 60;
  }

  const boxWidth = (pageWidth - margin * 2 - 10) / 2;

  doc.rect(margin, startY, boxWidth, 50).fill(COLORS.light).stroke(COLORS.border);
  doc.rect(margin + boxWidth + 10, startY, boxWidth, 50).fill(COLORS.light).stroke(COLORS.border);

  doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(8)
    .text('SOCIEDAD ORGANIZADORA', margin + 6, startY + 6);
  doc.font(FONTS.normal).fontSize(9)
    .text(competencia.sociedadId?.nombre || '-', margin + 6, startY + 18, { width: boxWidth - 12 });
  doc.fontSize(8).fillColor(COLORS.muted)
    .text(`Provincia: ${competencia.sociedadId?.provincia || '-'}   Tel: ${competencia.sociedadId?.telefono || '-'}`,
      margin + 6, startY + 32, { width: boxWidth - 12 });

  const jx = margin + boxWidth + 16;
  doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(8)
    .text('JUEZ CALIFICADOR', jx, startY + 6);
  if (competencia.juezId) {
    doc.font(FONTS.normal).fontSize(9)
      .text(`${competencia.juezId.apellido}, ${competencia.juezId.nombre}`, jx, startY + 18, { width: boxWidth - 12 });
    doc.fontSize(8).fillColor(COLORS.muted)
      .text(`Código: ${competencia.juezId.codigo}   DNI: ${competencia.juezId.dni}`, jx, startY + 32, { width: boxWidth - 12 });
  } else {
    doc.font(FONTS.italic).fontSize(9).fillColor(COLORS.muted)
      .text('Sin juez asignado', jx, startY + 18);
  }

  return startY + 60;
}

function drawTableHeader(doc, y, columns, bgColor = COLORS.secondary) {
  const margin = 40;
  const pageWidth = doc.page.width;
  const rowHeight = 18;

  doc.rect(margin, y, pageWidth - margin * 2, rowHeight).fill(bgColor);
  doc.fillColor('white').font(FONTS.bold).fontSize(8);

  let x = margin;
  for (const col of columns) {
    doc.text(col.label, x + 3, y + 5, { width: col.width - 6, align: col.align || 'left' });
    x += col.width;
  }
  return y + rowHeight;
}

function drawTableRow(doc, y, columns, data, isEven = false) {
  const margin = 40;
  const pageWidth = doc.page.width;
  const rowHeight = 16;

  if (isEven) {
    doc.rect(margin, y, pageWidth - margin * 2, rowHeight).fill('#f8fafc');
  }
  doc.rect(margin, y, pageWidth - margin * 2, rowHeight).stroke(COLORS.border);

  doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(8);
  let x = margin;
  for (const col of columns) {
    const value = data[col.key] !== undefined && data[col.key] !== null ? String(data[col.key]) : '-';
    doc.text(value, x + 3, y + 4, { width: col.width - 6, align: col.align || 'left' });
    x += col.width;
  }
  return y + rowHeight;
}

// ─── Número de página ─────────────────────────────────────────────────────────
function drawPageNum(doc, pageNum) {
  const pw = doc.page.width;
  const ph = doc.page.height;
  doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(7)
    .text(`Página ${pageNum}`, 40, ph - 18, { align: 'right', width: pw - 80, lineBreak: false });
}

// ─── Tarjeta de catálogo (dos columnas) ──────────────────────────────────────
function drawCatalogCard(doc, x, y, w, h, item) {
  const STRIP_W = 34;

  doc.rect(x, y, w, h).fill('#f8fafc');
  doc.rect(x, y, w, h).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.rect(x, y, STRIP_W, h).fill(COLORS.secondary);

  const jaulaStr = item.numJaula != null ? String(item.numJaula) : '?';
  const jaulaFs = jaulaStr.length > 3 ? 9 : 13;
  doc.fillColor('white').font(FONTS.bold).fontSize(jaulaFs)
    .text(jaulaStr, x, y + Math.floor(h / 2) - Math.floor(jaulaFs / 2) - 2,
      { width: STRIP_W, align: 'center', lineBreak: false });

  const tx = x + STRIP_W + 5;
  const tw = w - STRIP_W - 9;

  // Socio
  const socioNombre = item.socioId
    ? `${item.socioId.apellido || ''}, ${item.socioId.nombre || ''}`.replace(/^,\s*/, '').trim()
    : (item.numCriador || '-');
  doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(8)
    .text(socioNombre, tx, y + 5, { width: tw, lineBreak: false });

  // Anillo: Sociedad - Criador - Anillo - Año
  const anilloParts = [
    item.socioId?.sociedadId?.nombre,
    item.numCriador,
    item.numAnillo,
    item.anioAnillo
  ].filter(v => v != null && v !== '');
  doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(7)
    .text(anilloParts.join(' - '), tx, y + 17, { width: tw, lineBreak: false });

  // Puntaje y Premio
  const halfTw = Math.floor(tw / 2);
  doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(8)
    .text(`Puntaje: ${item.puntaje != null ? item.puntaje : '-'}`, tx, y + 30, { width: halfTw, lineBreak: false });

  const premiosStr = (item.premios || []).map(p => p.tipo).join(', ') || '-';
  doc.fillColor(COLORS.accent).font(FONTS.bold).fontSize(7)
    .text(`Premio: ${premiosStr}`, tx + halfTw, y + 30, { width: halfTw, lineBreak: false });

  // Descripción de premios (si hay)
  const premioDesc = (item.premios || []).map(p => p.descripcion).filter(Boolean).join(' · ');
  if (premioDesc && h >= 56) {
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(6)
      .text(premioDesc, tx, y + 42, { width: tw, lineBreak: false });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO — columnas verticales (flujo tipo periódico), orden Color→Forma
// Encabezado: "Federación Argentina de Canaricultura — Año XXXX"
// Cada sección: fila de título (código | nombre línea | tipo línea)
//               fila de cabecera (Jaula | Criador | Anillo | Puntaje | Premio)
//               filas de datos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abrevia el nombre de la línea: las primeras 2 palabras completas, a partir de la 3ª
 * solo los primeros 3 caracteres.
 * Ejemplo: "Gran Campeón Nacional Dorado" → "Gran Campeón Nac Dor"
 */
function abreviarNombreLinea(nombre) {
  if (!nombre) return '-';
  const palabras = nombre.trim().split(/\s+/);
  return palabras
    .map((p, i) => i < 2 ? p : p.slice(0, 3))
    .join(' ');
}

/**
 * Title-case con abreviación a partir de la 3ª palabra.
 * "AGATA MOSAICO AMARILLO MACHO" → "Agata Mosaico Ama Mac"
 */
function titleCaseAbrev(str) {
  if (!str) return '-';
  return str.trim().split(/\s+/).map((w, i) => {
    const cap = w.toLowerCase().replace(/^./, c => c.toUpperCase());
    return i < 2 ? cap : cap.slice(0, 3);
  }).join(' ');
}

/**
 * Formatea premios eliminando duplicados. Usa solo p.tipo (evita "CA: CA").
 */
function formatPremios(premios) {
  if (!premios || !premios.length) return '-';
  const tipos = [...new Set(premios.map(p => p.tipo).filter(Boolean))];
  return tipos.length ? tipos.join(' ') : '-';
}

/**
 * Formato criador para catálogo: APELLIDO, Nombre (máx 15 chars total).
 * Apellido en mayúsculas, nombre con primera letra mayúscula.
 */
function formatCriadorCatalogo(socio, numCriador) {
  if (socio) {
    const apellido = (socio.apellido || '').toUpperCase();
    const nombre   = (socio.nombre   || '').toLowerCase().replace(/^./, c => c.toUpperCase());
    return `${apellido}, ${nombre}`.replace(/^,\s*/, '').trim().slice(0, 20);
  }
  return (numCriador || '-').slice(0, 20);
}

/**
 * Construye las secciones ordenadas (color→forma, por lote, individual→duos→cuartetos).
 * Para cuartetos, se excluyen los suplentes y se agrupa por grupoPresentacion
 * insertando un separador (null) entre grupos distintos.
 */
function buildCatalogoSections(inscripciones) {
  const TIPO_ORD = { individual: 0, duos: 1, cuartetos: 2 };
  inscripciones.sort((a, b) => {
    if (a.tipoNomenclador !== b.tipoNomenclador)
      return a.tipoNomenclador === 'color' ? -1 : 1;
    const loteA = a.lote || '', loteB = b.lote || '';
    if (loteA !== loteB) return loteA.localeCompare(loteB);
    const ta = TIPO_ORD[a.tipoPresentacion] ?? 0;
    const tb = TIPO_ORD[b.tipoPresentacion] ?? 0;
    if (ta !== tb) return ta - tb;
    return (a.numJaula ?? 0) - (b.numJaula ?? 0);
  });

  const sections = [];
  for (const insc of inscripciones) {
    const key = `${insc.tipoNomenclador}|${insc.lote}|${insc.tipoPresentacion}`;
    const last = sections[sections.length - 1];
    if (!last || last._key !== key) {
      sections.push({
        _key: key,
        tipoNomenclador: insc.tipoNomenclador,
        lote: insc.lote,
        nombreNomenclador: insc.nombreNomenclador,
        tipoPresentacion: insc.tipoPresentacion,
        items: [insc]
      });
    } else {
      last.items.push(insc);
    }
  }
  return sections;
}

// Genera el catálogo en memoria y devuelve un Buffer.
// Usado por pdfRevista.service para incrustar el catálogo en la revista.
exports.generarCatalogoBuffer = (competenciaId) => {
  const { PassThrough } = require('stream');
  return new Promise((resolve, reject) => {
    const chunks = [];
    const pt = new PassThrough();
    pt.on('data', c => chunks.push(c));
    pt.on('end',  () => resolve(Buffer.concat(chunks)));
    pt.on('error', reject);
    const mockRes = Object.assign(pt, {
      setHeader: () => {},
      getHeader: () => null,
      statusCode: 200
    });
    exports.generarCatalogo(competenciaId, mockRes).catch(reject);
  });
};

exports.generarCatalogo = async (competenciaId, res) => {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId').populate('juezId');
  if (!competencia) throw new Error('Competencia no encontrada');

  const inscripciones = await Inscripcion.find({ competenciaId: competencia._id })
    .populate({ path: 'socioId', populate: { path: 'sociedadId', select: 'nombre' } })
    .lean();

  const sections = buildCatalogoSections(inscripciones);

  // Mapa loteKey → juezStr desde AsignacionJuez
  // loteKey = "<codigoNomenclador>|<tipoPresentacion>"
  const juezPorLote = new Map();
  const asignaciones = await AsignacionJuez.find({ competenciaId: competencia._id })
    .populate('juecesIds', 'apellido nombre').lean();
  for (const asig of asignaciones) {
    if (!asig.juecesIds?.length) continue;
    const juecesStr = asig.juecesIds
      .map(j => `${(j.apellido || '').toUpperCase()}, ${j.nombre || ''}`)
      .join(' / ');
    const key = `${asig.codigoNomenclador}|${asig.tipoPresentacion}`;
    juezPorLote.set(key, juecesStr);
    // Si la asignación es "todos", cubrir también cada tipo específico
    if (asig.tipoPresentacion === 'todos') {
      for (const tp of ['individual', 'duos', 'cuartetos']) {
        juezPorLote.set(`${asig.codigoNomenclador}|${tp}`, juecesStr);
      }
    }
  }

  const anio = competencia.fecha
    ? new Date(competencia.fecha).getFullYear()
    : new Date().getFullYear();

  const doc = new PDFDocument({
    size: 'A4', margin: 30,
    info: { Title: `Catálogo - ${competencia.nombre}`, Author: 'Sistema de Canaricultura' }
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="catalogo-${competenciaId}.pdf"`);
  doc.pipe(res);

  // ── Constantes de página ──────────────────────────────────────────────────
  const PAGE_W   = doc.page.width;   // 595.28
  const PAGE_H   = doc.page.height;  // 841.89
  const MARGIN   = 30;
  const HEADER_H = 44;  // altura del encabezado superior
  const FOOTER_H = 20;
  const NUM_COLS = 2;
  const COL_GAP  = 8;
  const COL_W    = Math.floor((PAGE_W - MARGIN * 2 - COL_GAP * (NUM_COLS - 1)) / NUM_COLS);

  const CONTENT_TOP    = MARGIN + HEADER_H + 8;
  const CONTENT_BOTTOM = PAGE_H - FOOTER_H - MARGIN;

  // ── Alturas de filas dentro de cada columna ───────────────────────────────
  // Calculadas como lineHeight(fontSize) + 3 pt de margen (1.5 arriba + 1.5 abajo)
  // fontSize 6.5 → lineHeight ≈ 8  → SEC_H  = 10
  // fontSize 6   → lineHeight ≈ 7.5 → JUEZ_H =  9
  // fontSize 5   → lineHeight ≈ 6   → HEAD_H =  9, DATA_H = 9
  const SEC_H  = 10;
  const JUEZ_H =  9;
  const HEAD_H =  9;
  const DATA_H =  9;

  // ── Sub-anchos dentro de una columna (deben sumar COL_W) ─────────────────
  const J_W = 26;   // Jaula
  const C_W = 72;   // Criador — más ancho; desplaza Puntaje y Premio a la derecha
  const A_W = Math.floor(COL_W * 0.30); // Anillo compuesto (ligeramente reducido)
  const P_W = 34;   // Puntaje
  const R_W = COL_W - J_W - C_W - A_W - P_W; // Premio (resto)

  const TIPO_PRES_ES = { individual: 'Individuales', duos: 'Dúos', cuartetos: 'Cuartetos' };

  // ── Estado de columna activa ───────────────────────────────────────────────
  let pageNum  = 1;
  let activeCol = 0;        // 0 = izquierda, 1 = derecha
  let curY     = CONTENT_TOP;

  const colX = (col) => MARGIN + col * (COL_W + COL_GAP);

  // ── Encabezado de página ──────────────────────────────────────────────────
  const drawCatPageHeader = () => {
    doc.rect(0, MARGIN, PAGE_W, HEADER_H).fill(COLORS.primary);
    doc.fillColor('white').font(FONTS.bold).fontSize(16)
      .text(
        `Federacion Argentina de Canaricultura - Ano ${anio}`,
        MARGIN, MARGIN + 8,
        { align: 'center', width: PAGE_W - MARGIN * 2, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.normal).fontSize(8)
      .text(
        competencia.nombre,
        MARGIN, MARGIN + 30,
        { align: 'center', width: PAGE_W - MARGIN * 2, lineBreak: false }
      );
    // Línea acento
    doc.rect(0, MARGIN + HEADER_H, PAGE_W, 3).fill(COLORS.accent);
  };

  // ── Pie de página ─────────────────────────────────────────────────────────
  // IMPORTANTE: y debe satisfacer  y + lineHeight < PAGE_H - margin  para que
  // PDFKit no inserte una página automática antes de dibujar el texto.
  // Con margin=30 el umbral es 811.89 pt; fontSize 7 → lineHeight ≈ 8.4 pt.
  // Usamos CONTENT_BOTTOM (791.89) + 2 = 793.89  →  793.89 + 8.4 = 802.29 < 811.89  ✓
  const drawCatPageFooter = () => {
    doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(7)
      .text(`Pagina ${pageNum}`, MARGIN, CONTENT_BOTTOM + 2,
        { align: 'right', width: PAGE_W - MARGIN * 2, lineBreak: false });
  };

  // ── Avanzar a la siguiente columna (o nueva página) ───────────────────────
  const advanceColumn = () => {
    activeCol++;
    if (activeCol >= NUM_COLS) {
      drawCatPageFooter();
      doc.addPage();
      pageNum++;
      drawCatPageHeader();
      activeCol = 0;
    }
    curY = CONTENT_TOP;
  };

  // ── Fila de título de sección ─────────────────────────────────────────────
  const drawSectionTitle = (x, y, section) => {
    const loteKey = `${section.lote}|${section.tipoPresentacion || 'todos'}`;
    // Fila 1: código | nombre línea | tipo + presentación
    doc.rect(x, y, COL_W, SEC_H).fill(COLORS.accent);

    const CODE_W = 30;
    doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(6.5)
      .text(section.lote || '-', x + 2, y + 1.5,
        { width: CODE_W - 4, align: 'center', lineBreak: false });

    doc.strokeColor(COLORS.primary).lineWidth(0.5)
      .moveTo(x + CODE_W, y).lineTo(x + CODE_W, y + SEC_H).stroke();

    const NOMBRE_W = Math.floor((COL_W - CODE_W) * 0.6);
    doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(5.5)
      .text(abreviarNombreLinea(section.nombreNomenclador), x + CODE_W + 3, y + 2,
        { width: NOMBRE_W - 6, align: 'center', lineBreak: false });

    doc.strokeColor(COLORS.primary).lineWidth(0.5)
      .moveTo(x + CODE_W + NOMBRE_W, y).lineTo(x + CODE_W + NOMBRE_W, y + SEC_H).stroke();

    const tipoLabel = section.tipoNomenclador === 'color' ? 'Color' : 'Forma/Postura';
    const presLabel = TIPO_PRES_ES[section.tipoPresentacion] || '';
    doc.fillColor(COLORS.primary).font(FONTS.normal).fontSize(5.5)
      .text(`${tipoLabel} · ${presLabel}`,
        x + CODE_W + NOMBRE_W + 3, y + 2,
        { width: COL_W - CODE_W - NOMBRE_W - 6, lineBreak: false });

    // Fila 2: juez de la mesa que tiene este lote
    const jy = y + SEC_H;
    doc.rect(x, jy, COL_W, JUEZ_H).fill('#e8edf2');
    const juezMesa = juezPorLote.get(loteKey);
    const juezStr  = juezMesa ? `Juez: ${juezMesa}` : 'Juez: -';
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(6)
      .text(juezStr, x + 3, jy + 1.5, { width: COL_W - 6, lineBreak: false });

    return jy + JUEZ_H;
  };

  // ── Fila de cabecera (Jaula | Criador | Anillo | Puntaje | Premio) ─────────
  const drawColHeader = (x, y) => {
    doc.rect(x, y, COL_W, HEAD_H).fill(COLORS.secondary);
    doc.fillColor('white').font(FONTS.bold).fontSize(5);
    const labels = [
      { label: 'Jaula',   w: J_W, align: 'center' },
      { label: 'Criador', w: C_W, align: 'center' },
      { label: 'Anillo',  w: A_W, align: 'left'   },
      { label: 'Puntaje', w: P_W, align: 'center' },
      { label: 'Premio',  w: R_W, align: 'left'   },
    ];
    let cx = x;
    for (const col of labels) {
      doc.text(col.label, cx + 2, y + 2, { width: col.w - 4, align: col.align, lineBreak: false });
      cx += col.w;
    }
    return y + HEAD_H;
  };

  // ── Fila de dato ──────────────────────────────────────────────────────────
  const drawDataRow = (x, y, item, isEven) => {
    if (isEven) doc.rect(x, y, COL_W, DATA_H).fill('#f0f4f8');
    doc.rect(x, y, COL_W, DATA_H).strokeColor(COLORS.border).lineWidth(0.3).stroke();

    const anilloParts = [
      item.socioId?.sociedadId?.nombre,
      item.numCriador,
      item.numAnillo,
      item.anioAnillo
    ].filter(v => v != null && v !== '');

    const premiosStr = formatPremios(item.premios);
    const criadorStr = formatCriadorCatalogo(item.socioId, item.numCriador);

    doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(5);

    let cx = x;
    // Jaula
    doc.font(FONTS.bold)
      .text(item.numJaula != null ? String(item.numJaula) : '?',
        cx + 2, y + 2, { width: J_W - 4, align: 'center', lineBreak: false });
    cx += J_W;
    // Criador
    doc.font(FONTS.normal)
      .text(criadorStr, cx + 2, y + 2, { width: C_W - 4, align: 'left', lineBreak: false });
    cx += C_W;
    // Anillo compuesto
    doc.text(anilloParts.join(' - '),
      cx + 2, y + 2, { width: A_W - 4, align: 'left', lineBreak: false });
    cx += A_W;
    // Puntaje
    doc.font(FONTS.bold)
      .text(item.puntaje != null ? String(item.puntaje) : '-',
        cx + 2, y + 2, { width: P_W - 4, align: 'center', lineBreak: false });
    cx += P_W;
    // Premio
    doc.font(FONTS.normal).fillColor(COLORS.accent)
      .text(premiosStr, cx + 2, y + 2, { width: R_W - 4, align: 'left', lineBreak: false });

    return y + DATA_H;
  };

  // ── Línea separadora entre cuartetos ─────────────────────────────────────
  const CUARTETO_SEP = 4; // puntos de espacio en blanco entre grupos de cuarteto

  // ── Iniciar primera página ─────────────────────────────────────────────────
  drawCatPageHeader();

  // ── Renderizar secciones ──────────────────────────────────────────────────
  for (const section of sections) {
    const esCuarteto = section.tipoPresentacion === 'cuartetos';

    // Para cuartetos: excluir suplentes y agrupar por grupoPresentacion
    // Cada grupo se renderiza junto; entre grupos se inserta un separador visual.
    let renderItems; // array de items o arrays-de-grupo para cuartetos
    if (esCuarteto) {
      const grupoMap = new Map();
      for (const item of section.items) {
        if (item.esSuplente) continue; // excluir suplentes
        const key = item.grupoPresentacion || String(item._id);
        if (!grupoMap.has(key)) grupoMap.set(key, []);
        grupoMap.get(key).push(item);
      }
      renderItems = [...grupoMap.values()]
        .sort((a, b) => (a[0].numJaula ?? 0) - (b[0].numJaula ?? 0));
    } else {
      renderItems = section.items;
    }

    // Espacio mínimo: título + fila juez + cabecera + al menos 1 fila de dato
    const minH = SEC_H + JUEZ_H + HEAD_H + DATA_H;
    if (curY + minH > CONTENT_BOTTOM) advanceColumn();

    const x = colX(activeCol);
    curY = drawSectionTitle(x, curY, section);
    curY = drawColHeader(x, curY);

    if (esCuarteto) {
      // renderItems es array de grupos; cada grupo es un array de items
      for (let g = 0; g < renderItems.length; g++) {
        const grupo = renderItems[g];
        for (let i = 0; i < grupo.length; i++) {
          if (curY + DATA_H > CONTENT_BOTTOM) {
            advanceColumn();
            curY = drawColHeader(colX(activeCol), curY);
          }
          curY = drawDataRow(colX(activeCol), curY, grupo[i], i % 2 === 0);
        }
        // Separador entre cuartetos (excepto tras el último)
        if (g < renderItems.length - 1) {
          curY += CUARTETO_SEP;
        }
      }
    } else {
      for (let i = 0; i < renderItems.length; i++) {
        if (curY + DATA_H > CONTENT_BOTTOM) {
          advanceColumn();
          curY = drawColHeader(colX(activeCol), curY);
        }
        curY = drawDataRow(colX(activeCol), curY, renderItems[i], i % 2 === 0);
      }
    }

    curY += 4; // espacio entre secciones
  }

  drawCatPageFooter();

  // ── Tablas de posiciones ───────────────────────────────────────────────────
  await generarTablasRanking(doc, competencia._id);

  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
// TABLAS DE RANKING — 4 tablas landscape: socio/sociedad × color/forma
// ─────────────────────────────────────────────────────────────────────────────

async function generarTablasRanking(doc, competenciaId) {
  const Premio = require('../models/Premio');
  const Socio  = require('../models/Socio');

  // Cargar config de puntos (o usar defaults del controller)
  const { DEFAULTS } = require('../controllers/premio.controller');
  const dbPremios = await Premio.find().lean();
  const puntosConfig = {};
  // Start from defaults
  for (const [tipo, def] of Object.entries(DEFAULTS)) {
    puntosConfig[tipo] = {
      individual: def.puntosIndividual,
      duos: def.puntosDuos,
      cuartetos: def.puntosCuartetos
    };
  }
  // Override with DB values
  for (const p of dbPremios) {
    puntosConfig[p.tipo] = {
      individual: p.puntosIndividual,
      duos: p.puntosDuos,
      cuartetos: p.puntosCuartetos
    };
  }

  // Cargar todas las inscripciones con populate
  const inscripciones = await require('../models/Inscripcion')
    .find({ competenciaId })
    .populate({ path: 'socioId', populate: { path: 'sociedadId', select: 'nombre' } })
    .lean();

  if (inscripciones.length === 0) return;

  const TIPOS_PRES = ['individual', 'duos', 'cuartetos'];

  // Tipos de mención tal como los almacena JuraPage ('1°'–'10°')
  const TIPOS_MENCION = new Set(['1°','2°','3°','4°','5°','6°','7°','8°','9°','10°']);
  const esMencion = (tipo) => TIPOS_MENCION.has(tipo);

  // Calcula puntos de un array de premios para un tipoPresentacion
  const calcularPuntos = (premios, tipoPres) => {
    let total = 0;
    for (const p of (premios || [])) {
      const cfg = puntosConfig[p.tipo];
      if (!cfg) continue;
      total += cfg[tipoPres] || 0;
    }
    return total;
  };

  // Construye estadísticas para una inscripcion.
  // GCA (Gran Campeón Absoluto) se cuenta en puntos y premiados pero no tiene
  // columna propia en la tabla de ranking; se incluye en el conteo de 'ca'
  // por ser un premio de nivel campeón.
  const statsInscripcion = (insc) => {
    const tp = insc.tipoPresentacion || 'individual';
    const premios = insc.premios || [];
    const gca  = premios.filter(p => p.tipo === 'GCA').length;
    const ca   = premios.filter(p => p.tipo === 'CA').length;
    const rc   = premios.filter(p => p.tipo === 'RC').length;
    const mencs = premios.filter(p => esMencion(p.tipo)).length;
    // GCA se suma a la columna CA (ambos son premios de nivel campeón)
    const caTotal = gca + ca;
    return {
      tipoPres: tp,
      puntos: calcularPuntos(premios, tp),
      ca: caTotal, rc, mencs,
      presentado: 1,
      premiado: caTotal + rc + mencs
    };
  };

  // Agrupa inscripciones por (tipoNomenclador, clave) donde clave es socioId o sociedadId.
  // Para dúos y cuartetos se procesa solo UNA inscripción por grupoPresentacion (la primera),
  // ya que todas las aves del grupo comparten los mismos premios y tipoPresentacion.
  const buildRanking = (filtroTipo, porSociedad) => {
    const mapa = new Map(); // clave → { nombre, sociedadNombre, stats por tipoPres }
    // Rastrea grupos ya procesados: "clave_entry|grupoPresentacion" → true
    const grupoVisto = new Set();

    for (const insc of inscripciones) {
      if (insc.tipoNomenclador !== filtroTipo) continue;
      if (insc.esSuplente) continue; // excluir suplentes

      const tipoPres = insc.tipoPresentacion || 'individual';

      // Para dúos y cuartetos: contar el grupo solo una vez.
      // Si grupoPresentacion es null (dato legacy), se procesa normalmente.
      if (tipoPres !== 'individual' && insc.grupoPresentacion) {
        const grupoKey = `${tipoPres}|${insc.grupoPresentacion}`;
        if (grupoVisto.has(grupoKey)) continue;
        grupoVisto.add(grupoKey);
      }

      const socio = insc.socioId;
      let clave, nombre, sociedadNombre;

      if (porSociedad) {
        const soc = socio?.sociedadId;
        clave = soc?._id?.toString() || insc.numCriador;
        nombre = soc?.nombre || insc.numCriador || '-';
        sociedadNombre = '';
      } else {
        clave = socio?._id?.toString() || insc.numCriador;
        nombre = socio
          ? `${socio.apellido || ''}, ${socio.nombre || ''}`.replace(/^,\s*/, '').trim()
          : (insc.numCriador || '-');
        sociedadNombre = socio?.sociedadId?.nombre || '-';
      }

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          nombre, sociedadNombre,
          individual: { puntos: 0, ca: 0, rc: 0, mencs: 0, presentados: 0, premiados: 0 },
          duos:       { puntos: 0, ca: 0, rc: 0, mencs: 0, presentados: 0, premiados: 0 },
          cuartetos:  { puntos: 0, ca: 0, rc: 0, mencs: 0, presentados: 0, premiados: 0 },
        });
      }

      const entry = mapa.get(clave);
      const s = statsInscripcion(insc);
      // tp siempre es una de las tres claves válidas; si por algún dato incorrecto
      // no coincide, cae a 'individual' como fallback seguro.
      const tp = (tipoPres === 'duos' || tipoPres === 'cuartetos') ? tipoPres : 'individual';

      entry[tp].puntos      += s.puntos;
      entry[tp].ca          += s.ca;
      entry[tp].rc         += s.rc;
      entry[tp].mencs       += s.mencs;
      entry[tp].presentados += 1;
      entry[tp].premiados   += s.premiado;
    }

    // Convertir a array con puntos totales y ordenar descendente
    return [...mapa.values()]
      .map(e => ({
        ...e,
        totalPuntos: e.individual.puntos + e.duos.puntos + e.cuartetos.puntos
      }))
      .sort((a, b) => b.totalPuntos - a.totalPuntos);
  };

  const TABLAS = [
    { titulo: 'Posiciones por Socio — Rama Color',          datos: buildRanking('color', false),  porSociedad: false },
    { titulo: 'Posiciones por Sociedad — Rama Color',        datos: buildRanking('color', true),   porSociedad: true  },
    { titulo: 'Posiciones por Socio — Rama Forma / Postura', datos: buildRanking('forma', false),  porSociedad: false },
    { titulo: 'Posiciones por Sociedad — Rama Forma / Postura', datos: buildRanking('forma', true), porSociedad: true },
  ];

  for (const tabla of TABLAS) {
    if (tabla.datos.length === 0) continue;
    await renderTablaRanking(doc, tabla.titulo, tabla.datos, tabla.porSociedad, competenciaId);
  }
}

async function renderTablaRanking(doc, titulo, datos, porSociedad, competenciaId) {
  // Landscape page
  doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });

  const PW = doc.page.width;   // ~841.89
  const PH = doc.page.height;  // ~595.28
  const MARGIN = 28;
  const USABLE = PW - MARGIN * 2;

  const COLORS_R = {
    header: '#1e3a5f',
    accent: '#f59e0b',
    subhdr: '#2563eb',
    subhdr2:'#3b82f6',
    text:   '#1e293b',
    muted:  '#64748b',
    even:   '#f8fafc',
    border: '#cbd5e1'
  };

  // Column layout
  const C_POS  = 22;
  const C_NAME = porSociedad ? 160 : 120;
  const C_SOC  = porSociedad ? 0   : 80;
  const C_PTS  = 40;
  // 3 presentation types × (CA + RCA + Mencs) = 9 data columns
  const COLS_DATA = ['CA', 'RC', 'Mencs'];
  const PRES_LABELS = ['Individuales', 'Dúos', 'Cuartetos'];
  const C_STAT = 22; // each data column
  const C_PRES = 22; // Presentados / Premiados cols
  // total cols per pres: 3 stats + 2 counts = 5
  // 3 pres groups × 5 = 15 cols
  const C_GROUP = C_STAT * 3 + C_PRES * 2; // 66 + 44 = 110... let me recalc
  // Actually: per presentation: CA(22) + RCA(22) + Mencs(22) + Pres(22) + Prem(22) = 110
  const C_ONE_PRES = C_STAT * 3 + C_PRES * 2; // = 110
  const TOTAL_W = C_POS + C_NAME + C_SOC + C_PTS + C_ONE_PRES * 3;

  // Scale to fit USABLE width
  const SCALE = USABLE / TOTAL_W;
  const s = (v) => Math.floor(v * SCALE);

  const ROW_H1 = 13; // main header
  const ROW_H2 = 11; // subheader pres type
  const ROW_H3 = 10; // column labels
  const ROW_H  = 10; // data row
  const HDR_BLOCK = ROW_H1 + ROW_H2 + ROW_H3;

  const FOOTER_H = 16;
  const CONTENT_TOP = MARGIN + 30 + 8; // title bar
  const CONTENT_BOTTOM = PH - MARGIN - FOOTER_H;

  let pageNum = 1;
  let y = MARGIN;

  const drawTitleBar = () => {
    doc.rect(0, y, PW, 30).fill(COLORS_R.header);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
      .text(titulo, MARGIN, y + 9, { width: USABLE, align: 'center', lineBreak: false });
    doc.rect(0, y + 30, PW, 3).fill(COLORS_R.accent);
    y += 33;
  };

  const drawFooter = () => {
    const fy = PH - MARGIN - FOOTER_H;
    doc.fillColor(COLORS_R.header).rect(0, fy, PW, FOOTER_H + MARGIN).fill();
    doc.fillColor('white').font('Helvetica').fontSize(7)
      .text(`${titulo}  |  Pág. ${pageNum}`, MARGIN, fy + 5,
        { width: USABLE, align: 'center', lineBreak: false });
  };

  const drawTableHeader = (startY) => {
    let cy = startY;
    const x0 = MARGIN;

    // Row 1: merged group headers
    doc.rect(x0, cy, USABLE, ROW_H1).fill(COLORS_R.subhdr);

    const labels1 = [
      { text: 'Pos',                  w: s(C_POS),  align: 'center' },
      { text: porSociedad ? 'Sociedad' : 'Socio', w: s(C_NAME), align: 'left' },
      ...(porSociedad ? [] : [{ text: 'Sociedad', w: s(C_SOC), align: 'left' }]),
      { text: 'Puntos', w: s(C_PTS), align: 'center' },
      { text: 'INDIVIDUALES',  w: s(C_ONE_PRES), align: 'center' },
      { text: 'DÚOS',          w: s(C_ONE_PRES), align: 'center' },
      { text: 'CUARTETOS',     w: s(C_ONE_PRES), align: 'center' },
    ];
    let cx = x0;
    for (const col of labels1) {
      doc.fillColor('white').font('Helvetica-Bold').fontSize(6)
        .text(col.text, cx + 2, cy + 3, { width: col.w - 4, align: col.align, lineBreak: false });
      cx += col.w;
    }
    cy += ROW_H1;

    // Row 2: sub-group headers per pres type (CA RCA Mencs Pres Prem)
    doc.rect(x0, cy, USABLE, ROW_H2).fill(COLORS_R.subhdr2);
    cx = x0;
    // Fixed columns
    for (const col of [
      { w: s(C_POS) }, { w: s(C_NAME) }, ...(porSociedad ? [] : [{ w: s(C_SOC) }]), { w: s(C_PTS) }
    ]) {
      cx += col.w;
    }
    // Data groups
    for (let g = 0; g < 3; g++) {
      for (const lbl of ['CA', 'RC', 'M', 'Pres.', 'Prem.']) {
        doc.fillColor('white').font('Helvetica').fontSize(5.5)
          .text(lbl, cx + 1, cy + 3, { width: s(lbl === 'CA' || lbl === 'RC' || lbl === 'M' ? C_STAT : C_PRES) - 2, align: 'center', lineBreak: false });
        cx += s(lbl === 'CA' || lbl === 'RC' || lbl === 'M' ? C_STAT : C_PRES);
      }
    }
    cy += ROW_H2;

    return cy;
  };

  const drawDataRow = (startY, rowData, idx) => {
    const x0 = MARGIN;
    if (idx % 2 === 0) {
      doc.rect(x0, startY, USABLE, ROW_H).fill(COLORS_R.even);
    }
    doc.rect(x0, startY, USABLE, ROW_H).strokeColor(COLORS_R.border).lineWidth(0.25).stroke();

    let cx = x0;
    const cell = (text, w, align = 'center', bold = false) => {
      doc.fillColor(COLORS_R.text).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(6)
        .text(String(text ?? '-'), cx + 2, startY + 2, { width: w - 4, align, lineBreak: false });
      cx += w;
    };

    // Puesto
    cell(idx + 1, s(C_POS), 'center', true);
    cell(rowData.nombre, s(C_NAME), 'left');
    if (!porSociedad) cell(rowData.sociedadNombre, s(C_SOC), 'left');
    doc.fillColor('#2563eb').font('Helvetica-Bold').fontSize(7)
      .text(String(rowData.totalPuntos), cx + 2, startY + 1, { width: s(C_PTS) - 4, align: 'center', lineBreak: false });
    cx += s(C_PTS);

    for (const tp of ['individual', 'duos', 'cuartetos']) {
      const d = rowData[tp] || { ca: 0, rc: 0, mencs: 0, presentados: 0, premiados: 0 };
      for (const [val, w] of [
        [d.ca,         C_STAT],
        [d.rc,        C_STAT],
        [d.mencs,      C_STAT],
        [d.presentados, C_PRES],
        [d.premiados,   C_PRES]
      ]) {
        doc.fillColor(val > 0 ? COLORS_R.text : COLORS_R.muted)
          .font('Helvetica').fontSize(6)
          .text(String(val), cx + 1, startY + 2, { width: s(w) - 2, align: 'center', lineBreak: false });
        cx += s(w);
      }
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  drawTitleBar();

  let headerY = y;
  y = drawTableHeader(headerY);

  for (let i = 0; i < datos.length; i++) {
    if (y + ROW_H > CONTENT_BOTTOM) {
      drawFooter();
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
      pageNum++;
      y = MARGIN;
      drawTitleBar();
      headerY = y;
      y = drawTableHeader(headerY);
    }
    drawDataRow(y, datos[i], i);
    y += ROW_H;
  }

  drawFooter();
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLA DE JURA — flujo continuo entre lotes, sin páginas en blanco
// ─────────────────────────────────────────────────────────────────────────────
exports.generarPlanillaJura = async (competenciaId, res) => {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId').populate('juezId');
  if (!competencia) throw new Error('Competencia no encontrada');

  const rawLotes = await Inscripcion.aggregate([
    { $match: { competenciaId: competencia._id } },
    {
      $group: {
        _id: { lote: '$lote', tipoPresentacion: '$tipoPresentacion' },
        nombreNomenclador: { $first: '$nombreNomenclador' },
        tipoNomenclador:   { $first: '$tipoNomenclador' },
        minJaula:          { $min: '$numJaula' },
        items:             { $push: '$$ROOT' }
      }
    },
    { $sort: { minJaula: 1 } }
  ]);

  // Construir mapa (codigoNomenclador|tipoPresentacion) → {numero, juezStr}
  const mesasData = await Mesa.find({ competenciaId: competencia._id })
    .populate('juecesIds', 'apellido nombre').lean();
  const mesaPorLote = new Map();
  for (const mesa of mesasData) {
    const juezStr = (mesa.juecesIds || []).length > 0
      ? mesa.juecesIds.map(j => `${j.apellido}, ${j.nombre}`).join(' / ')
      : null;
    for (const lote of (mesa.lotes || [])) {
      const addKey = (tp) => {
        const key = `${lote.codigoNomenclador}|${tp}`;
        if (!mesaPorLote.has(key)) {
          mesaPorLote.set(key, {
            numero: mesa.numero,
            juezStr
          });
        }
      };
      if (lote.tipoPresentacion === 'todos') {
        ['individual', 'duos', 'cuartetos'].forEach(tp => addKey(tp));
      } else {
        addKey(lote.tipoPresentacion);
      }
    }
  }

  // Ordenar: color→forma, luego por código de lote, luego por número de mesa
  const TIPO_NOM_ORD = { color: 0, forma: 1 };
  const inscripcionesPorLote = rawLotes
    .map(lote => ({
      ...lote,
      items: [...lote.items].sort((a, b) => (a.numJaula ?? 0) - (b.numJaula ?? 0)),
      mesaInfo: mesaPorLote.get(`${lote._id.lote}|${lote._id.tipoPresentacion}`) || null
    }))
    .sort((a, b) => {
      const tA = TIPO_NOM_ORD[a.tipoNomenclador] ?? 1;
      const tB = TIPO_NOM_ORD[b.tipoNomenclador] ?? 1;
      if (tA !== tB) return tA - tB;
      const lA = a._id.lote || '';
      const lB = b._id.lote || '';
      if (lA !== lB) return lA.localeCompare(lB);
      return (a.mesaInfo?.numero ?? 999) - (b.mesaInfo?.numero ?? 999);
    });

  const doc = new PDFDocument({
    size: 'A4', margin: 0,
    info: { Title: `Planilla de Jura - ${competencia.nombre}`, Author: 'Sistema de Canaricultura' }
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="planilla-jura-${competenciaId}.pdf"`);
  doc.pipe(res);

  const PAGE_W = doc.page.width;
  const PAGE_H = doc.page.height;
  const MARGIN = 40;
  const FOOTER_ZONE = 115;
  const CONTENT_BOTTOM = PAGE_H - FOOTER_ZONE;

  const COLS = 6;
  const COL_GAP = 5;
  const CARD_W = Math.floor((PAGE_W - MARGIN * 2 - COL_GAP * (COLS - 1)) / COLS);
  const CARD_H = 80;
  const ROW_GAP = 6;
  const NUM_H = 26;
  const BOTTOM_H = CARD_H - NUM_H;

  const USABLE_W = PAGE_W - MARGIN * 2;
  const GRP_COLS = [
    { label: 'Numero de Jaula',  w: 70  },
    { label: 'Numero de Anillo', w: 120 },
    { label: 'Premio',           w: USABLE_W - 310 },
    { label: 'Puntaje',          w: 120 }
  ];
  const GRP_HEADER_H = 20;
  const GRP_ROW_H    = 22;
  const GRP_GAP      = 8;

  const TIPO_PRES_LABEL = { individual: 'INDIVIDUALES', duos: 'DUOS', cuartetos: 'CUARTETOS' };
  let pageNum = 1;
  let currentLoteLabel = '';
  let currentJuezStr = '';
  const titulo = `PLANILLA DE JURA — ${competencia.nombre}`;

  // ── Pie de página: observaciones primero, luego firma del juez ─────────────
  const drawPageFooter = (pNum, loteLabel, juezStr) => {
    const fy = PAGE_H - FOOTER_ZONE;
    const usable = PAGE_W - MARGIN * 2;

    doc.strokeColor(COLORS.border).lineWidth(0.5)
      .moveTo(MARGIN, fy).lineTo(PAGE_W - MARGIN, fy).stroke();

    // 1) Caja de observaciones (ocupa la parte superior del footer)
    const obsY = fy + 6;
    const obsH = 36;
    doc.strokeColor(COLORS.border).lineWidth(0.5)
      .rect(MARGIN, obsY, usable, obsH).stroke();
    doc.fillColor(COLORS.muted).font(FONTS.bold).fontSize(6)
      .text('OBSERVACIONES:', MARGIN + 4, obsY + 4, { lineBreak: false });

    // 2) Líneas de firma — una por juez asignado al lote (o línea en blanco si no hay)
    const sigAreaY = obsY + obsH + 6;
    const jueces = juezStr ? juezStr.split(' / ') : [''];
    const numJueces = Math.max(jueces.length, 1);
    const sigW = Math.floor((usable - 8 * (numJueces - 1)) / numJueces);

    jueces.forEach((nombre, idx) => {
      const sigX = MARGIN + idx * (sigW + 8);
      const lineY = sigAreaY + 20;
      doc.strokeColor(COLORS.text).lineWidth(0.5)
        .moveTo(sigX, lineY).lineTo(sigX + sigW - 4, lineY).stroke();
      doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(7)
        .text('Firma', sigX, lineY + 3, { width: sigW - 4, align: 'center', lineBreak: false });
      if (nombre.trim()) {
        doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(7)
          .text(nombre.trim(), sigX, lineY - 11, { width: sigW - 4, align: 'center', lineBreak: false });
      }
    });

    // 3) Barra inferior con lote, competencia, fecha y número de página
    const barY = sigAreaY + 36;
    const barH = PAGE_H - barY;
    doc.fillColor(COLORS.primary).rect(0, barY, PAGE_W, barH).fill();
    doc.fillColor('white').font(FONTS.normal).fontSize(7)
      .text(
        `${loteLabel}   |   ${competencia.nombre}   |   ${new Date().toLocaleString('es-AR')}`,
        MARGIN, barY + Math.floor((barH - 7) / 2),
        { width: PAGE_W - MARGIN * 2 - 60, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.bold).fontSize(7)
      .text(
        `Página ${pNum}`,
        MARGIN, barY + Math.floor((barH - 7) / 2),
        { align: 'right', width: PAGE_W - MARGIN * 2, lineBreak: false }
      );
  };

  // ── Nueva página con encabezado compacto ─────────────────────────────────
  const nextPage = () => {
    drawPageFooter(pageNum, currentLoteLabel, currentJuezStr);
    doc.addPage();
    pageNum++;
    return drawCompactHeader(doc, competencia, titulo);
  };

  // ── Tarjeta individual ────────────────────────────────────────────────────
  const drawCard = (x, y, numJaula, numAnillo) => {
    const halfW = Math.floor(CARD_W / 2);
    const botY = y + NUM_H;

    doc.fillColor(COLORS.light).rect(x, botY, CARD_W, BOTTOM_H).fill();
    doc.fillColor(COLORS.primary).rect(x, y, CARD_W, NUM_H).fill();
    doc.strokeColor(COLORS.border).lineWidth(0.75).rect(x, y, CARD_W, CARD_H).stroke();
    doc.strokeColor(COLORS.border).lineWidth(0.5)
      .moveTo(x, botY).lineTo(x + CARD_W, botY).stroke();
    doc.strokeColor(COLORS.border).lineWidth(0.5)
      .moveTo(x + halfW, botY).lineTo(x + halfW, y + CARD_H).stroke();

    doc.fillColor('white').font(FONTS.bold).fontSize(12)
      .text(numJaula != null ? String(numJaula) : '?', x, y + 4,
        { width: CARD_W, align: 'center', lineBreak: false });
    if (numAnillo != null) {
      doc.fillColor('white').font(FONTS.normal).fontSize(7)
        .text(`Anillo: ${numAnillo}`, x, y + 17,
          { width: CARD_W, align: 'center', lineBreak: false });
    }
    doc.fillColor(COLORS.muted).font(FONTS.bold).fontSize(6)
      .text('PREMIO', x + 4, botY + 4, { width: halfW - 8, lineBreak: false });
    doc.fillColor(COLORS.muted).font(FONTS.bold).fontSize(6)
      .text('PUNTAJE', x + halfW + 4, botY + 4, { width: halfW - 8, lineBreak: false });
  };

  // ── Rectángulo ancho para grupo (dúo/cuarteto) ───────────────────────────
  const drawGrupoCard = (y, grupoItems) => {
    const totalH = GRP_HEADER_H + grupoItems.length * GRP_ROW_H;

    doc.fillColor(COLORS.secondary).rect(MARGIN, y, USABLE_W, GRP_HEADER_H).fill();
    doc.strokeColor(COLORS.border).lineWidth(0.75).rect(MARGIN, y, USABLE_W, totalH).stroke();

    let cx = MARGIN;
    for (let j = 0; j < GRP_COLS.length; j++) {
      const col = GRP_COLS[j];
      doc.fillColor('white').font(FONTS.bold).fontSize(7)
        .text(col.label, cx + 3, y + 6, { width: col.w - 6, align: 'center', lineBreak: false });
      if (j < GRP_COLS.length - 1) {
        doc.strokeColor('white').lineWidth(0.5)
          .moveTo(cx + col.w, y).lineTo(cx + col.w, y + GRP_HEADER_H).stroke();
      }
      cx += col.w;
    }

    for (let i = 0; i < grupoItems.length; i++) {
      const item = grupoItems[i];
      const rowY = y + GRP_HEADER_H + i * GRP_ROW_H;

      doc.strokeColor(COLORS.border).lineWidth(0.5)
        .moveTo(MARGIN, rowY).lineTo(MARGIN + USABLE_W, rowY).stroke();

      cx = MARGIN;
      for (let j = 0; j < GRP_COLS.length - 1; j++) {
        cx += GRP_COLS[j].w;
        doc.strokeColor(COLORS.border).lineWidth(0.5)
          .moveTo(cx, rowY).lineTo(cx, rowY + GRP_ROW_H).stroke();
      }

      cx = MARGIN;
      doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(11)
        .text(item.numJaula != null ? String(item.numJaula) : '?',
          cx + 3, rowY + 5, { width: GRP_COLS[0].w - 6, align: 'center', lineBreak: false });
      cx += GRP_COLS[0].w;
      doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(9)
        .text(item.numAnillo || '-',
          cx + 3, rowY + 6, { width: GRP_COLS[1].w - 6, align: 'center', lineBreak: false });
    }
    return y + totalH;
  };

  const makeLoteLabel = (lote, loteNum) => {
    const cod  = lote._id.lote || '';
    const tipo = TIPO_PRES_LABEL[lote._id.tipoPresentacion] || 'INDIVIDUAL';
    const nom  = lote.tipoNomenclador === 'color' ? 'COLOR' : 'FORMA';
    return `LOTE ${loteNum}: ${cod} - ${lote.nombreNomenclador?.toUpperCase() || ''} - ${tipo} (${nom})`;
  };

  const drawLoteBanner = (lote, loteNum, mesaInfo, y) => {
    const BH = 26;
    doc.fillColor(COLORS.accent).rect(MARGIN, y, PAGE_W - MARGIN * 2, BH).fill();
    const mesaStr = mesaInfo ? ` [Mesa ${mesaInfo.numero}]` : '';
    const fullText = `LOTE ${loteNum}: ${lote._id.lote || ''} ${lote.nombreNomenclador?.toUpperCase() || ''} - ${TIPO_PRES_LABEL[lote._id.tipoPresentacion] || 'INDIVIDUAL'}${mesaStr}`;
    doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(9)
      .text(
        fullText,
        MARGIN + 6, y + 8,
        { width: PAGE_W - MARGIN * 2 - 12, lineBreak: false }
      );
    doc.fillColor(COLORS.primary).font(FONTS.normal).fontSize(7)
      .text(
        `(${lote.tipoNomenclador === 'color' ? 'COLOR' : 'FORMA/POSTURA'})   ${lote.items.length} jaulas`,
        MARGIN + 6, y + 8,
        { align: 'right', width: PAGE_W - MARGIN * 2 - 12, lineBreak: false }
      );
    return y + BH + 4;
  };

  // ── Primera página ────────────────────────────────────────────────────────
  let y = drawHeader(doc, competencia, titulo);
  y = drawInfoBlock(doc, competencia, y, true); // sin recuadro de juez calificador
  y += 8;

  // ── Renderizado: cada lote comienza en nueva página ─────────────────────
  for (let li = 0; li < inscripcionesPorLote.length; li++) {
    const lote = inscripcionesPorLote[li];
    const loteNum = li + 1;
    const loteLabel = makeLoteLabel(lote, loteNum);
    const tipoPres = lote._id.tipoPresentacion || 'individual';
    const items = lote.items;

    // A partir del segundo lote, siempre nueva página
    if (li > 0) {
      drawPageFooter(pageNum, currentLoteLabel, currentJuezStr);
      doc.addPage();
      pageNum++;
      y = drawCompactHeader(doc, competencia, titulo);
    }
    currentLoteLabel = loteLabel;
    currentJuezStr = lote.mesaInfo?.juezStr || '';

    y = drawLoteBanner(lote, loteNum, lote.mesaInfo, y);

    if (tipoPres === 'individual') {
      // ── Tarjetas individuales (grilla 4 columnas) ─────────────────────────
      let col = 0;
      let rowY = y;

      for (let i = 0; i < items.length; i++) {
        if (col === 0 && rowY + CARD_H > CONTENT_BOTTOM) {
          y = nextPage();
          // Banner de continuación
          const contBH = 22;
          doc.fillColor(COLORS.accent).rect(MARGIN, y, PAGE_W - MARGIN * 2, contBH).fill();
          doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(9)
            .text(`${loteLabel}  (cont.)`, MARGIN + 6, y + 7,
              { width: PAGE_W - MARGIN * 2 - 12, lineBreak: false });
          rowY = y + contBH + 6;
        }

        const cardX = MARGIN + col * (CARD_W + COL_GAP);
        drawCard(cardX, rowY, items[i].numJaula, items[i].numAnillo);

        col++;
        if (col >= COLS) { col = 0; rowY += CARD_H + ROW_GAP; }
      }
      y = rowY + (col > 0 ? CARD_H + ROW_GAP : 0);

    } else {
      // ── Rectángulos anchos para dúos/cuartetos ────────────────────────────
      const groupMap = new Map();
      for (const item of items) {
        const key = item.grupoPresentacion || String(item._id);
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(item);
      }
      const groups = [...groupMap.values()]
        .map(g => g.sort((a, b) => (a.numJaula ?? 0) - (b.numJaula ?? 0)))
        .sort((a, b) => (a[0].numJaula ?? 0) - (b[0].numJaula ?? 0));

      for (const group of groups) {
        const gh = GRP_HEADER_H + group.length * GRP_ROW_H;
        if (y + gh > CONTENT_BOTTOM) {
          y = nextPage();
          const contBH = 22;
          doc.fillColor(COLORS.accent).rect(MARGIN, y, PAGE_W - MARGIN * 2, contBH).fill();
          doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(9)
            .text(`${loteLabel}  (cont.)`, MARGIN + 6, y + 7,
              { width: PAGE_W - MARGIN * 2 - 12, lineBreak: false });
          y = y + contBH + 6;
        }
        y = drawGrupoCard(y, group);
        y += GRP_GAP;
      }
    }
  }

  // Pie de la última página
  drawPageFooter(pageNum, currentLoteLabel, currentJuezStr);
  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
// LISTADO POR LOTE
// ─────────────────────────────────────────────────────────────────────────────
exports.generarListadoLote = async (competenciaId, res) => {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId').populate('juezId');
  if (!competencia) throw new Error('Competencia no encontrada');

  const cerrada = competencia.estadoInscripcion !== 'abierta';
  const competenciaAnio = competencia.fecha
    ? new Date(competencia.fecha).getFullYear()
    : new Date().getFullYear();

  // Agrupar por codigoNomenclador (lote) + tipoPresentacion
  const rawLotes = await Inscripcion.aggregate([
    { $match: { competenciaId: competencia._id } },
    {
      $group: {
        _id: { lote: '$lote', tipoPresentacion: '$tipoPresentacion' },
        nombreNomenclador: { $first: '$nombreNomenclador' },
        tipoNomenclador:   { $first: '$tipoNomenclador' },
        items:             { $push: '$$ROOT' }
      }
    },
    { $sort: { '_id.lote': 1, '_id.tipoPresentacion': 1 } }
  ]);

  const inscripcionesPorLote = rawLotes.map(l => ({
    ...l,
    items: [...l.items].sort((a, b) =>
      cerrada
        ? (a.numJaula ?? 0) - (b.numJaula ?? 0)
        : (a.numCriador || '').localeCompare(b.numCriador || '')
    )
  }));

  const doc = new PDFDocument({ size: 'A4', margin: 40,
    info: { Title: `Listado por Lote - ${competencia.nombre}`, Author: 'Sistema de Canaricultura' }
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="listado-lote-${competenciaId}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const PAGE_H   = doc.page.height;
  const MARGIN   = 40;
  const usableW  = pageWidth - MARGIN * 2;
  const titulo   = `LISTADO POR LOTE — ${competencia.nombre}`;

  // CONTENT_BOTTOM incluye margen para que doc.text() no supere page.maxY()
  const FOOTER_H       = 22;
  const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_H; // ≈ 779.89 pt

  const TIPO_LABEL = { individual: 'INDIVIDUAL', duos: 'DUOS', cuartetos: 'CUARTETOS' };

  const columns = cerrada
    ? [
        { key: 'jaula',   label: 'JAULA',      width: 45,  align: 'center' },
        { key: 'anillo',  label: 'N° ANILLO',  width: 110, align: 'center' },
        { key: 'tipo',    label: 'TIPO',        width: 80,  align: 'center' },
        { key: 'anio',    label: 'AÑO',         width: 50,  align: 'center' },
        { key: 'puntaje', label: 'PUNTAJE',     width: 70,  align: 'center' },
        { key: 'premios', label: 'PREMIOS',     width: usableW - 355, align: 'left' },
      ]
    : [
        { key: 'anillo',  label: 'N° ANILLO',  width: 110, align: 'center' },
        { key: 'tipo',    label: 'TIPO',        width: 80,  align: 'center' },
        { key: 'anio',    label: 'AÑO',         width: 50,  align: 'center' },
        { key: 'premios', label: 'PREMIOS',     width: usableW - 240, align: 'left' },
      ];

  let pageNum   = 1;
  let firstPage = true;

  const drawFooterBar = () => {
    // Rect cubre desde CONTENT_BOTTOM hasta el borde de la hoja
    doc.fillColor(COLORS.primary)
      .rect(0, CONTENT_BOTTOM, pageWidth, PAGE_H - CONTENT_BOTTOM).fill();
    // Texto en CONTENT_BOTTOM + 5 ≈ 784.89 pt < page.maxY() ≈ 801.89 pt → sin página automática
    doc.fillColor('white').font(FONTS.normal).fontSize(7)
      .text(
        `Listado por Lote  |  ${competencia.nombre}  |  ${new Date().toLocaleString('es-AR')}`,
        MARGIN, CONTENT_BOTTOM + 5, { width: pageWidth - MARGIN * 2 - 80, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.bold).fontSize(7)
      .text(`Pág. ${pageNum}`, MARGIN, CONTENT_BOTTOM + 5,
        { align: 'right', width: pageWidth - MARGIN * 2, lineBreak: false });
  };

  // Dos barras grises como separador visual entre grupos (duos/cuartetos)
  const drawGrupoSep = (y) => {
    doc.rect(MARGIN, y,     usableW, 5).fill('#dde3ea');
    doc.rect(MARGIN, y + 7, usableW, 5).fill('#dde3ea');
    return y + 16;
  };

  let y = 0;

  for (const lote of inscripcionesPorLote) {
    // Cada lote empieza en una nueva hoja
    if (!firstPage) {
      drawFooterBar();
      doc.addPage();
      pageNum++;
      y = drawCompactHeader(doc, competencia, titulo);
    } else {
      y = drawHeader(doc, competencia, titulo);
      y = drawInfoBlock(doc, competencia, y, true);
      y += 10;
      firstPage = false;
    }

    const tipoPres  = lote._id.tipoPresentacion || 'individual';
    const tipoLabel = TIPO_LABEL[tipoPres] || 'INDIVIDUAL';
    const nomLabel  = lote.nombreNomenclador?.toUpperCase() || '';
    const nomType   = lote.tipoNomenclador === 'color' ? 'COLOR' : 'FORMA/POSTURA';
    const juezStr   = competencia.juezId
      ? `Juez: ${competencia.juezId.apellido}, ${competencia.juezId.nombre}`
      : 'Sin juez asignado';

    // Banner de 2 líneas: código+nombre+tipo en la primera, juez+cantidad en la segunda
    const BANNER_H = 38;
    doc.rect(MARGIN, y, usableW, BANNER_H).fill(COLORS.primary);
    doc.fillColor('white').font(FONTS.bold).fontSize(10)
      .text(
        `LOTE: ${lote._id.lote || '-'}  ${nomLabel} - ${tipoLabel} (${nomType})`,
        MARGIN + 6, y + 5, { width: usableW - 12, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.normal).fontSize(8)
      .text(
        `${juezStr}   |   ${lote.items.length} ejemplares`,
        MARGIN + 6, y + 22, { width: usableW - 12, lineBreak: false }
      );
    y += BANNER_H;
    y = drawTableHeader(doc, y, columns);

    if (tipoPres === 'individual') {
      for (let i = 0; i < lote.items.length; i++) {
        if (y > CONTENT_BOTTOM - 16) {
          drawFooterBar();
          doc.addPage();
          pageNum++;
          y = drawCompactHeader(doc, competencia, titulo);
          y = drawTableHeader(doc, y, columns);
        }
        const item = lote.items[i];
        y = drawTableRow(doc, y, columns, {
          jaula:   item.numJaula ?? '-',
          anillo:  item.numAnillo,
          tipo:    tipoLabel,
          anio:    item.anioAnillo ?? (competenciaAnio - 1),
          puntaje: item.puntaje ?? '-',
          premios: formatPremios(item.premios),
        }, i % 2 === 0);
      }
    } else {
      // Agrupar por grupoPresentacion para separar cada dúo/cuarteto
      const groupMap = new Map();
      for (const item of lote.items) {
        const key = item.grupoPresentacion || String(item._id);
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(item);
      }
      const groups = [...groupMap.values()]
        .sort((a, b) => (a[0].numJaula ?? 0) - (b[0].numJaula ?? 0));

      let rowGlobal = 0;
      for (let g = 0; g < groups.length; g++) {
        const group    = groups[g];
        const groupPx  = group.length * 16; // DATA_H = 16
        if (y + groupPx > CONTENT_BOTTOM - 16) {
          drawFooterBar();
          doc.addPage();
          pageNum++;
          y = drawCompactHeader(doc, competencia, titulo);
          y = drawTableHeader(doc, y, columns);
          rowGlobal = 0;
        }
        for (let i = 0; i < group.length; i++) {
          const item = group[i];
          y = drawTableRow(doc, y, columns, {
            jaula:   item.numJaula ?? '-',
            anillo:  item.numAnillo,
            tipo:    tipoLabel,
            anio:    item.anioAnillo ?? (competenciaAnio - 1),
            puntaje: item.puntaje ?? '-',
            premios: formatPremios(item.premios),
          }, rowGlobal % 2 === 0);
          rowGlobal++;
        }
        // Separador entre grupos (no tras el último)
        if (g < groups.length - 1) {
          if (y + 16 > CONTENT_BOTTOM - 16) {
            drawFooterBar();
            doc.addPage();
            pageNum++;
            y = drawCompactHeader(doc, competencia, titulo);
            y = drawTableHeader(doc, y, columns);
          }
          y = drawGrupoSep(y);
        }
      }
    }
  }

  drawFooterBar();
  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
// LISTADO POR SOCIO — columna "Nombre de línea" junto al lote
// ─────────────────────────────────────────────────────────────────────────────
exports.generarListadoSocio = async (competenciaId, res) => {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId').populate('juezId');
  if (!competencia) throw new Error('Competencia no encontrada');

  const inscripciones = await Inscripcion.find({ competenciaId: competencia._id })
    .populate('socioId', 'nombre apellido anilloCriador')
    .sort({ numCriador: 1, lote: 1, numJaula: 1, numAnillo: 1 });

  const socioMap = new Map();
  for (const insc of inscripciones) {
    const key = insc.numCriador;
    if (!socioMap.has(key)) {
      socioMap.set(key, {
        numCriador: insc.numCriador,
        nombre: insc.socioId ? `${insc.socioId.apellido}, ${insc.socioId.nombre}` : insc.numCriador,
        items: []
      });
    }
    socioMap.get(key).items.push(insc);
  }
  const socios = [...socioMap.values()];

  const doc = new PDFDocument({ size: 'A4', margin: 40,
    info: { Title: `Listado por Socio - ${competencia.nombre}`, Author: 'Sistema de Canaricultura' }
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="listado-socio-${competenciaId}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const PAGE_H = doc.page.height;
  const usableW = pageWidth - 80;
  const cerrada = competencia.estadoInscripcion !== 'abierta';
  const titulo = `LISTADO POR SOCIO — ${competencia.nombre}`;
  // CONTENT_BOTTOM incluye margen para que doc.text() no supere page.maxY()
  const FOOTER_H       = 22;
  const CONTENT_BOTTOM = PAGE_H - 40 - FOOTER_H; // ≈ 779.89 pt

  // Columna LÍNEA ampliada a 130 pt; premios ajustado en consecuencia
  const columns = [
    ...(cerrada ? [{ key: 'jaula', label: 'JAULA', width: 36, align: 'center' }] : []),
    { key: 'lote',    label: 'LOTE',      width: 44,  align: 'center' },
    { key: 'linea',   label: 'LÍNEA',     width: 130, align: 'left'   },
    { key: 'anillo',  label: 'N° ANILLO', width: 80,  align: 'center' },
    { key: 'tipo',    label: 'TIPO',      width: 46,  align: 'center' },
    { key: 'anio',    label: 'AÑO',       width: 34,  align: 'center' },
    { key: 'puntaje', label: 'PUNTAJE',   width: 50,  align: 'center' },
    { key: 'premios', label: 'PREMIOS',   width: usableW - (cerrada ? 420 : 384), align: 'left' },
  ];

  let pageNum = 1;

  const drawFooterBar = () => {
    // Rect cubre desde CONTENT_BOTTOM hasta el borde de la hoja
    doc.fillColor(COLORS.primary)
      .rect(0, CONTENT_BOTTOM, pageWidth, PAGE_H - CONTENT_BOTTOM).fill();
    // Texto en CONTENT_BOTTOM + 5 ≈ 784.89 pt < page.maxY() ≈ 801.89 pt → sin página automática
    doc.fillColor('white').font(FONTS.normal).fontSize(7)
      .text(
        `Listado por Socio  |  ${competencia.nombre}  |  ${new Date().toLocaleString('es-AR')}`,
        40, CONTENT_BOTTOM + 5, { width: pageWidth - 120, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.bold).fontSize(7)
      .text(`Pág. ${pageNum}`, 40, CONTENT_BOTTOM + 5,
        { align: 'right', width: pageWidth - 80, lineBreak: false });
  };

  let y = drawHeader(doc, competencia, titulo);
  y = drawInfoBlock(doc, competencia, y, true);
  y += 10;

  for (const [socioIdx, socio] of socios.entries()) {
    if (socioIdx === 0) {
      if (y + 38 > CONTENT_BOTTOM) {
        drawFooterBar();
        doc.addPage();
        pageNum++;
        y = drawCompactHeader(doc, competencia, titulo);
      }
    } else {
      drawFooterBar();
      doc.addPage();
      pageNum++;
      y = drawCompactHeader(doc, competencia, titulo);
    }

    doc.rect(40, y, pageWidth - 80, 20).fill(COLORS.secondary);
    doc.fillColor('white').font(FONTS.bold).fontSize(9)
      .text(`${socio.numCriador}  |  ${socio.nombre}`, 46, y + 5,
        { width: pageWidth - 92, lineBreak: false });
    doc.fillColor('white').font(FONTS.normal).fontSize(8)
      .text(`${socio.items.length} ejemplares`, 46, y + 5,
        { align: 'right', width: pageWidth - 92, lineBreak: false });
    y += 20;
    y = drawTableHeader(doc, y, columns, COLORS.muted);

    for (let i = 0; i < socio.items.length; i++) {
      if (y > CONTENT_BOTTOM - 16) {
        drawFooterBar();
        doc.addPage();
        pageNum++;
        y = drawCompactHeader(doc, competencia, titulo);
        y = drawTableHeader(doc, y, columns, COLORS.muted);
      }
      const item = socio.items[i];
      y = drawTableRow(doc, y, columns, {
        jaula:   item.numJaula ?? '-',
        lote:    item.lote || item.codigoNomenclador || '-',
        linea:   titleCaseAbrev(item.nombreNomenclador),
        anillo:  item.numAnillo,
        tipo:    (item.tipoPresentacion || 'individual').toUpperCase().slice(0, 4),
        anio:    item.anioAnillo ?? '-',
        puntaje: item.puntaje ?? '-',
        premios: formatPremios(item.premios),
      }, i % 2 === 0);
    }
    y += 10;
  }

  drawFooterBar();
  doc.end();
};

// ─── Listado de Ejemplares por Variedad / Sociedad ────────────────────────────
exports.generarListadoVariedadSociedad = async (competenciaId, res) => {
  const competencia = await Competencia.findById(competenciaId)
    .populate('sociedadId').populate('juezId');
  if (!competencia) throw new Error('Competencia no encontrada');

  // Traer inscripciones con socio y su sociedad
  const inscripciones = await Inscripcion.find({ competenciaId: competencia._id })
    .populate({ path: 'socioId', select: 'apellido nombre anilloCriador sociedadId',
                populate: { path: 'sociedadId', select: 'nombre codigo' } })
    .sort({ numJaula: 1, numAnillo: 1 });

  // Año de nacimiento de los ejemplares (año de la competencia − 1)
  const añoComp     = competencia.fecha ? new Date(competencia.fecha).getFullYear() : new Date().getFullYear();
  const añoEjemplar = añoComp - 1;

  // Agrupar por sociedad
  const socMapOrder = [];
  const socMapData  = new Map();

  for (const insc of inscripciones) {
    const soc = insc.socioId?.sociedadId;
    const key  = soc?._id?.toString() || 'sin-sociedad';
    if (!socMapData.has(key)) {
      socMapOrder.push(key);
      socMapData.set(key, {
        nombre: soc?.nombre || 'Sin sociedad asignada',
        codigo: soc?.codigo || '',
        items: []
      });
    }
    socMapData.get(key).items.push(insc);
  }

  const grupos            = socMapOrder.map(k => socMapData.get(k));
  const totalEjemplares   = inscripciones.length;
  const totalSinSuplentes = inscripciones.filter(i => !i.esSuplente).length;

  // ── Documento ─────────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4', margin: 40,
    info: { Title: `Listado por Variedad/Sociedad - ${competencia.nombre}`, Author: 'Sistema de Canaricultura' }
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="listado-variedad-sociedad-${competenciaId}.pdf"`);
  doc.pipe(res);

  const PW          = doc.page.width;
  const PAGE_H      = doc.page.height;
  const MARGIN      = 40;
  const USABLE_W    = PW - MARGIN * 2;
  const FOOTER_H    = 22;
  const CONTENT_BTM = PAGE_H - MARGIN - FOOTER_H;
  const TITULO      = 'LISTADO DE EJEMPLARES POR VARIEDAD, SOCIEDAD';

  const cerrada = competencia.estadoInscripcion !== 'abierta';
  const JAULA_W = cerrada ? 38 : 0;
  // Ancho fijo acumulado: JAULA(opt)+ANILLO+AÑO+TIPO+SUPLENTE+CÓDIGO+VARIEDAD = 426 (sin jaula) / 464 (con jaula)
  // SOCIO ocupa el resto
  const VARIEDAD_W = 148;
  const SOCIO_W    = USABLE_W - JAULA_W - 72 - 36 - 68 - 52 - 50 - VARIEDAD_W;
  const columns = [
    ...(cerrada ? [{ key: 'jaula',   label: 'JAULA',    width: JAULA_W,   align: 'center' }] : []),
    { key: 'anillo',   label: 'N° ANILLO',  width: 72,        align: 'center' },
    { key: 'año',      label: 'AÑO',        width: 36,        align: 'center' },
    { key: 'tipo',     label: 'TIPO',       width: 68,        align: 'center' },
    { key: 'suplente', label: 'SUPLENTE',   width: 52,        align: 'center' },
    { key: 'codigo',   label: 'CÓDIGO',     width: 50,        align: 'center' },
    { key: 'variedad', label: 'VARIEDAD',   width: VARIEDAD_W, align: 'left'  },
    { key: 'socio',    label: 'SOCIO',      width: SOCIO_W,   align: 'center' },
  ];

  let pageNum = 1;

  const drawFooter = () => {
    doc.fillColor(COLORS.primary)
      .rect(0, CONTENT_BTM, PW, PAGE_H - CONTENT_BTM).fill();
    doc.fillColor('white').font(FONTS.normal).fontSize(7)
      .text(
        `${TITULO}  |  ${competencia.nombre}  |  ${new Date().toLocaleString('es-AR')}`,
        MARGIN, CONTENT_BTM + 5, { width: PW - 120, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.bold).fontSize(7)
      .text(`Pág. ${pageNum}`, MARGIN, CONTENT_BTM + 5,
        { align: 'right', width: USABLE_W, lineBreak: false });
  };

  // ── Primera página: encabezado con banner de totales ─────────────────────────
  let y = drawHeader(doc, competencia, TITULO);
  y = drawInfoBlock(doc, competencia, y, true);
  y += 8;

  // Banner de totales
  doc.rect(MARGIN, y, USABLE_W, 44).fill(COLORS.secondary);
  doc.fillColor('white').font(FONTS.bold).fontSize(10)
    .text(TITULO, MARGIN + 8, y + 6, { width: USABLE_W - 16, align: 'center' });
  const col3W = Math.floor(USABLE_W / 3);
  doc.fontSize(8).font(FONTS.normal);
  doc.text(`Total ejemplares: ${totalEjemplares}`,
    MARGIN + 8,         y + 26, { width: col3W - 8, align: 'center', lineBreak: false });
  doc.text(`Sin suplentes: ${totalSinSuplentes}`,
    MARGIN + col3W,     y + 26, { width: col3W,     align: 'center', lineBreak: false });
  doc.text(`Suplentes: ${totalEjemplares - totalSinSuplentes}`,
    MARGIN + col3W * 2, y + 26, { width: col3W - 8, align: 'center', lineBreak: false });
  y += 54;

  // ── Recorrer grupos por sociedad ──────────────────────────────────────────────
  for (const grupo of grupos) {
    if (y + 40 > CONTENT_BTM) {
      drawFooter();
      doc.addPage();
      pageNum++;
      y = drawCompactHeader(doc, competencia, TITULO);
    }

    // Encabezado de sociedad
    doc.rect(MARGIN, y, USABLE_W, 20).fill(COLORS.primary);
    doc.fillColor('white').font(FONTS.bold).fontSize(9)
      .text(
        `${grupo.codigo ? grupo.codigo + '  —  ' : ''}${grupo.nombre}`,
        MARGIN + 6, y + 5, { width: USABLE_W * 0.72, lineBreak: false }
      );
    doc.fillColor('white').font(FONTS.normal).fontSize(8)
      .text(`${grupo.items.length} ejemplar${grupo.items.length !== 1 ? 'es' : ''}`,
        MARGIN, y + 6, { align: 'right', width: USABLE_W - 8, lineBreak: false });
    y += 20;

    y = drawTableHeader(doc, y, columns, COLORS.muted);

    for (let i = 0; i < grupo.items.length; i++) {
      if (y > CONTENT_BTM - 16) {
        drawFooter();
        doc.addPage();
        pageNum++;
        y = drawCompactHeader(doc, competencia, TITULO);
        y = drawTableHeader(doc, y, columns, COLORS.muted);
      }
      const item   = grupo.items[i];
      const añoStr = item.anioAnillo != null ? String(item.anioAnillo) : String(añoEjemplar);

      y = drawTableRow(doc, y, columns, {
        jaula:    item.numJaula ?? '-',
        anillo:   item.numAnillo,
        año:      añoStr,
        tipo:     (item.tipoPresentacion || 'individual').toUpperCase(),
        suplente: item.esSuplente ? 'Sí' : '',
        codigo:   item.codigoNomenclador || '-',
        variedad: titleCaseAbrev(item.nombreNomenclador),
        socio:    item.numCriador,
      }, i % 2 === 0);
    }
    y += 8;
  }

  if (inscripciones.length === 0) {
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(10)
      .text('No hay inscripciones registradas en esta competencia.',
        MARGIN, y + 20, { width: USABLE_W, align: 'center' });
  }

  drawFooter();
  doc.end();
};

// ─────────────────────────────────────────────────────────────────────────────
// CERTIFICADO DE LOGROS — A4 horizontal
// generarCertificado(competenciaId, userId, res)
// ─────────────────────────────────────────────────────────────────────────────
exports.generarCertificado = async (competenciaId, userId, res) => {
  // ── Datos ─────────────────────────────────────────────────────────────────
  const socio = await Socio.findOne({ userId });
  if (!socio) throw new Error('Perfil de socio no encontrado');

  const competencia = await Competencia.findById(competenciaId).populate('sociedadId');
  if (!competencia) throw new Error('Competencia no encontrada');

  // Solo inscripciones del socio con al menos un premio
  const todasInscripciones = await Inscripcion.find({
    competenciaId,
    socioId: socio._id,
    'premios.0': { $exists: true }
  }).sort({ lote: 1, grupoPresentacion: 1 });

  // Agrupar duos/cuartetos por grupoPresentacion
  const rows = [];
  const procesados = new Set();
  for (const insc of todasInscripciones) {
    const key = insc._id.toString();
    if (procesados.has(key)) continue;

    if (insc.grupoPresentacion && insc.tipoPresentacion !== 'individual') {
      const grupo = todasInscripciones.filter(
        i => i.grupoPresentacion === insc.grupoPresentacion && !i.esSuplente
      );
      grupo.forEach(i => procesados.add(i._id.toString()));
      rows.push({
        anillos: grupo.map(i => `${i.numCriador}_${i.numAnillo}_${i.anioAnillo || ''}`),
        tipo:    insc.tipoPresentacion,
        variedad: insc.nombreNomenclador || '-',
        puntaje: grupo.find(i => i.puntaje !== null)?.puntaje ?? null,
        premios: grupo.flatMap(i => i.premios || [])
      });
    } else {
      procesados.add(key);
      rows.push({
        anillos: [`${insc.numCriador}_${insc.numAnillo}_${insc.anioAnillo || ''}`],
        tipo:    insc.tipoPresentacion || 'individual',
        variedad: insc.nombreNomenclador || '-',
        puntaje: insc.puntaje,
        premios: insc.premios || []
      });
    }
  }

  // ── Documento A4 horizontal ───────────────────────────────────────────────
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const apellidoFn = (socio.apellido || 'SOCIO').replace(/\s+/g, '_');
  const nombreFn   = (socio.nombre   || '').replace(/\s+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="certificado_${apellidoFn}_${nombreFn}.pdf"`);
  doc.pipe(res);

  const PW = doc.page.width;   // 841.89
  const PH = doc.page.height;  // 595.28
  const M  = 40;
  const W  = PW - M * 2;

  // ── Colores del certificado ───────────────────────────────────────────────
  const AZUL_ARG = '#4a90c4';
  const ORO      = '#C9A84C';
  const NAVY     = '#1e3a5f';
  const ORO_LIGHT = '#F0D080';

  // ── Fondo: bandera argentina (baja opacidad) ──────────────────────────────
  const bandH = PH / 3;
  doc.save();
  doc.fillOpacity(0.18);
  doc.rect(0, 0,         PW, bandH).fill(AZUL_ARG);
  doc.rect(0, bandH,     PW, bandH).fill('#F8F8F8');
  doc.rect(0, bandH * 2, PW, bandH).fill(AZUL_ARG);
  doc.restore();

  // Sol de Mayo centrado (muy tenue)
  const sunX = PW / 2, sunY = PH / 2;
  doc.save();
  doc.fillOpacity(0.10);
  doc.strokeOpacity(0.10);
  const rIn = 32, rOut = 58;
  doc.lineWidth(5).strokeColor(ORO);
  for (let i = 0; i < 16; i++) {
    const ang = (i * 2 * Math.PI) / 16 - Math.PI / 2;
    doc.moveTo(sunX + rIn  * Math.cos(ang), sunY + rIn  * Math.sin(ang))
       .lineTo(sunX + rOut * Math.cos(ang), sunY + rOut * Math.sin(ang))
       .stroke();
  }
  doc.fillColor(ORO).circle(sunX, sunY, rIn).fill();
  doc.restore();

  // ── Marco dorado exterior ─────────────────────────────────────────────────
  doc.rect(12, 12, PW - 24, PH - 24)
    .lineWidth(3).strokeColor(ORO).stroke();
  doc.rect(17, 17, PW - 34, PH - 34)
    .lineWidth(0.8).strokeColor(ORO_LIGHT).stroke();

  // ── Cabecera ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, PW, 105).fill(NAVY);
  doc.rect(0, 105, PW, 4).fill(ORO);

  doc.fillColor('white').font(FONTS.bold).fontSize(15)
    .text('FEDERACIÓN ARGENTINA DE CANARICULTURA',
          M, 18, { width: W, align: 'center' });
  doc.fillColor(ORO_LIGHT).font(FONTS.bold).fontSize(11)
    .text('CERTIFICADO DE PARTICIPACIÓN Y LOGROS',
          M, 40, { width: W, align: 'center' });

  const fechaStr = competencia.fecha
    ? new Date(competencia.fecha).toLocaleDateString('es-AR',
        { day: '2-digit', month: 'long', year: 'numeric' })
    : '';
  doc.fillColor('white').font(FONTS.normal).fontSize(9)
    .text(competencia.nombre.toUpperCase(), M, 60, { width: W, align: 'center' });
  doc.font(FONTS.italic).fontSize(8)
    .text(
      [fechaStr, competencia.lugar].filter(Boolean).join('  ·  '),
      M, 78, { width: W, align: 'center' }
    );

  // ── Nombre del socio ──────────────────────────────────────────────────────
  let y = 118;
  doc.fillColor(NAVY).font(FONTS.bold).fontSize(26)
    .text(`${socio.apellido}, ${socio.nombre}`,
          M, y, { width: W, align: 'center' });
  y += 36;

  // Línea dorada decorativa bajo el nombre
  const lineX = PW / 2;
  doc.moveTo(lineX - 120, y).lineTo(lineX + 120, y)
    .lineWidth(1.5).strokeColor(ORO).stroke();
  y += 10;

  doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(10)
    .text('Logros Obtenidos en esta competencia',
          M, y, { width: W, align: 'center' });
  y += 22;

  // ── Tabla de logros ───────────────────────────────────────────────────────
  if (rows.length === 0) {
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(10)
      .text('Sin premios registrados en esta competencia.',
            M, y + 10, { width: W, align: 'center' });
  } else {
    // Anchos de columna (W ≈ 762)
    const CW = {
      anillo:  210,
      tipo:     80,
      variedad: 240,
      puntaje:  60,
      premio:   W - 210 - 80 - 240 - 60   // ~172
    };
    const colX = {
      anillo:  M,
      tipo:    M + CW.anillo,
      variedad: M + CW.anillo + CW.tipo,
      puntaje: M + CW.anillo + CW.tipo + CW.variedad,
      premio:  M + CW.anillo + CW.tipo + CW.variedad + CW.puntaje
    };

    // Cabecera de tabla
    doc.rect(M, y, W, 18).fill(NAVY);
    doc.fillColor('white').font(FONTS.bold).fontSize(8);
    [
      ['ANILLO (N°CRIADOR_ANILLO_AÑO)', colX.anillo,  CW.anillo,  'left'  ],
      ['TIPO',                           colX.tipo,    CW.tipo,    'center'],
      ['VARIEDAD',                       colX.variedad,CW.variedad,'left'  ],
      ['PUNTAJE',                        colX.puntaje, CW.puntaje, 'center'],
      ['PREMIO',                         colX.premio,  CW.premio,  'left'  ],
    ].forEach(([label, x, w, align]) => {
      doc.text(label, x + 4, y + 5, { width: w - 8, align });
    });
    y += 18;

    // Filas
    let even = true;
    for (const row of rows) {
      const anilloText = row.anillos.join('\n');
      const premioText = row.premios.map(p => p.tipo).join(' / ') || '-';
      // Estimar altura de fila según líneas del anillo
      const lines = row.anillos.length;
      const rowH  = Math.max(18, lines * 14);

      doc.rect(M, y, W, rowH).fill(even ? '#FAFAFA' : '#EEF3FA');
      even = !even;

      const textY = y + (rowH - 10) / 2;  // centrar verticalmente para 1 línea
      const multiY = y + 4;               // para múltiples líneas usar top

      doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(8);

      // Anillo(s)
      doc.text(anilloText,  colX.anillo   + 4, multiY, { width: CW.anillo   - 8, lineBreak: true });
      // Tipo
      doc.text(
        row.tipo.charAt(0).toUpperCase() + row.tipo.slice(1),
        colX.tipo     + 4, textY, { width: CW.tipo     - 8, align: 'center', lineBreak: false }
      );
      // Variedad
      doc.text(row.variedad, colX.variedad + 4, textY, { width: CW.variedad - 8, lineBreak: false });
      // Puntaje
      doc.fillColor(AZUL_ARG).font(FONTS.bold)
        .text(
          row.puntaje !== null && row.puntaje !== undefined ? String(row.puntaje) : '-',
          colX.puntaje + 4, textY, { width: CW.puntaje - 8, align: 'center', lineBreak: false }
        );
      // Premio
      doc.fillColor(ORO).font(FONTS.bold)
        .text(premioText, colX.premio + 4, textY, { width: CW.premio - 8, lineBreak: false });

      y += rowH;

      // Si se sale de la zona de contenido, detener (el certificado es 1 página)
      if (y > PH - 110) break;
    }
  }

  // ── Pie de página: firmas ─────────────────────────────────────────────────
  const footerY = PH - 80;
  doc.moveTo(M, footerY).lineTo(PW - M, footerY)
    .lineWidth(0.5).strokeColor(ORO).stroke();
  footerY && void 0; // evita lint warning

  const firmaY = footerY + 10;
  const firmaW = 180;
  const firma1X = M + 60;
  const firma2X = PW - M - 60 - firmaW;

  // Líneas de firma
  doc.moveTo(firma1X, firmaY + 38).lineTo(firma1X + firmaW, firmaY + 38)
    .lineWidth(0.8).strokeColor(COLORS.border).stroke();
  doc.moveTo(firma2X, firmaY + 38).lineTo(firma2X + firmaW, firmaY + 38)
    .lineWidth(0.8).strokeColor(COLORS.border).stroke();

  doc.fillColor(NAVY).font(FONTS.bold).fontSize(8)
    .text('Presidente de la FAC',
          firma1X, firmaY + 42, { width: firmaW, align: 'center' });
  doc.text('Presidente del Colegio de Jueces',
           firma2X, firmaY + 42, { width: firmaW, align: 'center' });

  // Año del certificado centrado
  doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(7)
    .text(
      `Generado el ${new Date().toLocaleDateString('es-AR')}`,
      M, firmaY + 42, { width: W, align: 'center' }
    );

  doc.end();
};
