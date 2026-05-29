const path = require('path');
const fs   = require('fs');
const PDFDocument = require('pdfkit');
const PagoCuota   = require('../models/PagoCuota');
const Socio       = require('../models/Socio');
const Sociedad    = require('../models/Sociedad');
const MovimientoSociedad = require('../models/MovimientoSociedad');

const MESES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const COLORS = {
  primary: '#1e3a5f',
  secondary: '#2563eb',
  light: '#f1f5f9',
  border: '#cbd5e1',
  text: '#1e293b',
  muted: '#64748b',
  green: '#16a34a',
  red: '#dc2626',
};
const FONTS = { normal: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };

function formatMoney(n) {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  // Usar valores UTC para evitar que la zona horaria desplace la fecha un día
  const day   = dt.getUTCDate();
  const month = dt.getUTCMonth() + 1;
  const year  = dt.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateFilename(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getUTCDate()).padStart(2, '0');
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const year  = dt.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// ── Cabecera común ────────────────────────────────────────────────────────────
function drawHeader(doc, sociedad, titulo) {
  const W = doc.page.width;
  const M = 40;
  doc.rect(0, 0, W, 90).fill(COLORS.primary);

  // Logo si existe
  let textX = M;
  const logoFile = sociedad?.logo
    ? path.join(__dirname, '../../uploads/logos', sociedad.logo)
    : null;
  if (logoFile && fs.existsSync(logoFile)) {
    try {
      doc.image(logoFile, M, 10, { height: 70, fit: [70, 70] });
      textX = M + 80;
    } catch (_) { /* ignorar si falla la imagen */ }
  }

  doc.fillColor('white').font(FONTS.bold).fontSize(14)
    .text(sociedad?.nombre?.toUpperCase() || 'SOCIEDAD', textX, 14,
          { align: 'center', width: W - textX - M });
  doc.fontSize(11)
    .text(titulo.toUpperCase(), textX, 36, { align: 'center', width: W - textX - M });
  const info = [sociedad?.direccion, sociedad?.telefono, sociedad?.mail]
    .filter(Boolean).join(' | ');
  doc.font(FONTS.normal).fontSize(8)
    .text(info, textX, 56, { align: 'center', width: W - textX - M });
  doc.moveDown(0.5);
}

// Línea separadora
function hrLine(doc, y, color = COLORS.border) {
  const M = 40;
  doc.moveTo(M, y).lineTo(doc.page.width - M, y).strokeColor(color).lineWidth(0.5).stroke();
}

// ── RECIBO ────────────────────────────────────────────────────────────────────
async function generarRecibo(pagoId, res) {
  const pago = await PagoCuota.findById(pagoId)
    .populate('socioId')
    .populate('competenciaId', 'nombre');
  if (!pago) throw new Error('Pago no encontrado');

  const sociedad = await Sociedad.findById(pago.sociedadId);
  const socio    = pago.socioId;

  const apellido = (socio?.apellido || 'SOCIO').replace(/\s+/g, '_');
  const nombre   = (socio?.nombre   || '').replace(/\s+/g, '_');
  const fechaFn  = formatDateFilename(pago.fechaPago);
  const pdfFilename = `${apellido}_${nombre}_${fechaFn}.pdf`;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="${pdfFilename}"`);
  doc.pipe(res);

  drawHeader(doc, sociedad, 'RECIBO DE PAGO');

  const M = 40;
  const W = doc.page.width - M * 2;
  let y = 105;

  // Número de recibo
  doc.rect(M, y, W, 28).fill(COLORS.light);
  doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(13)
    .text(`RECIBO N° ${pago.nroRecibo}`, M + 10, y + 7, { width: W / 2 });
  doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(10)
    .text(`Fecha: ${formatDate(pago.fechaPago)}`, M + W / 2, y + 9, { width: W / 2, align: 'right' });
  y += 38;

  // Datos del socio
  doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(10)
    .text('DATOS DEL SOCIO', M, y);
  y += 16;
  hrLine(doc, y);
  y += 8;

  const field = (label, value, x, fw) => {
    doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(8).text(label, x, y);
    doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(10).text(value || '-', x, y + 10, { width: fw });
  };

  field('Apellido y Nombre', `${socio?.apellido || ''}, ${socio?.nombre || ''}`, M, W * 0.55);
  field('N° Criador', socio?.anilloCriador || '', M + W * 0.6, W * 0.35);
  y += 32;
  field('DNI', socio?.dni || '', M, W * 0.3);
  field('Correo', socio?.correo || '', M + W * 0.35, W * 0.6);
  y += 32;
  field('Domicilio', socio?.domicilio || socio?.direccion || '-', M, W);
  y += 32;

  // Detalle del pago
  doc.fillColor(COLORS.text).font(FONTS.bold).fontSize(10).text('DETALLE', M, y);
  y += 16;
  hrLine(doc, y);
  y += 8;

  // Tipo
  let detalle = '';
  if (pago.tipo === 'mensual') {
    const m = pago.meses?.[0];
    detalle = m ? `Cuota mensual — ${MESES[m.mes]} ${m.año}` : 'Cuota mensual';
  } else if (pago.tipo === 'anual') {
    const año = pago.meses?.[0]?.año || '';
    detalle = `Cuota Anual - ${año}`;
  } else if (pago.tipo === 'derecho_jaula') {
    detalle = `Derecho de jaula — ${pago.cantidadJaulas} jaula(s)`;
    if (pago.competenciaId?.nombre) detalle += ` — ${pago.competenciaId.nombre}`;
  }
  if (pago.concepto) detalle += ` (${pago.concepto})`;

  doc.rect(M, y, W, 30).fill(COLORS.light);
  doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(10)
    .text(detalle, M + 10, y + 9, { width: W - 20 });
  y += 42;

  // Monto
  doc.rect(M, y, W, 40).fill(COLORS.primary);
  doc.fillColor('white').font(FONTS.bold).fontSize(11)
    .text('TOTAL PAGADO', M + 10, y + 6, { width: W / 2 });
  doc.fontSize(18)
    .text(formatMoney(pago.monto), M + W / 2, y + 4, { width: W / 2 - 10, align: 'right' });
  y += 58;

  // Firma
  y = Math.max(y, doc.page.height - 160);
  hrLine(doc, y);
  y += 12;
  doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(9)
    .text('Firma y sello del tesorero', M, y, { width: W / 2, align: 'center' })
    .text('Firma del socio', M + W / 2, y, { width: W / 2, align: 'center' });
  y += 40;
  doc.moveTo(M + 20, y).lineTo(M + W / 2 - 20, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.moveTo(M + W / 2 + 20, y).lineTo(M + W - 20, y).strokeColor(COLORS.border).lineWidth(0.5).stroke();

  doc.end();
}

// ── ESTADO DE CUENTA DEL SOCIO ────────────────────────────────────────────────
async function generarEstadoCuenta(socioId, res) {
  const socio    = await Socio.findById(socioId).populate('sociedadId');
  if (!socio) throw new Error('Socio no encontrado');
  const sociedad = socio.sociedadId;

  const pagos = await PagoCuota.find({ socioId })
    .populate('competenciaId', 'nombre')
    .sort({ fechaPago: 1 });

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="estado_cuenta_${socio.anilloCriador}.pdf"`);
  doc.pipe(res);

  drawHeader(doc, sociedad, 'ESTADO DE CUENTA DEL SOCIO');

  const M = 40;
  const W = doc.page.width - M * 2;
  let y = 105;

  // Datos del socio
  doc.rect(M, y, W, 28).fill(COLORS.light);
  doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(11)
    .text(`${socio.apellido}, ${socio.nombre}`, M + 10, y + 8, { width: W * 0.6 });
  doc.fillColor(COLORS.muted).font(FONTS.normal).fontSize(9)
    .text(`N° Criador: ${socio.anilloCriador}`, M + W * 0.6, y + 10, { width: W * 0.35, align: 'right' });
  y += 38;

  // Cabecera tabla
  const cols = [M, M + 80, M + 240, M + 360];
  const colW = [80, 160, 120, W - (360 - M)];
  doc.rect(M, y, W, 20).fill(COLORS.primary);
  doc.fillColor('white').font(FONTS.bold).fontSize(8);
  ['FECHA', 'CONCEPTO', 'N° RECIBO', 'MONTO'].forEach((h, i) => {
    doc.text(h, cols[i] + 4, y + 6, { width: colW[i] });
  });
  y += 20;

  let totalPagado = 0;
  let even = true;
  for (const p of pagos) {
    // Nueva página si es necesario
    if (y > doc.page.height - 120) {
      doc.addPage();
      drawHeader(doc, sociedad, 'ESTADO DE CUENTA DEL SOCIO (cont.)');
      y = 105;
    }

    doc.rect(M, y, W, 18).fill(even ? 'white' : COLORS.light);
    even = !even;

    let concepto = '';
    if (p.tipo === 'mensual') {
      const mm = p.meses?.[0];
      concepto = mm ? `Cuota ${MESES[mm.mes]} ${mm.año}` : 'Cuota mensual';
    } else if (p.tipo === 'anual') {
      const mStr = (p.meses || []).sort((a,b)=>a.mes-b.mes).map(m=>MESES[m.mes]).join('-');
      concepto = `Cuota anual (${mStr} ${p.meses?.[0]?.año || ''})`;
    } else if (p.tipo === 'derecho_jaula') {
      concepto = `Derecho jaula (${p.cantidadJaulas})`;
      if (p.competenciaId?.nombre) concepto += ` - ${p.competenciaId.nombre}`;
    }
    if (p.concepto) concepto += ` ${p.concepto}`;

    doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(8);
    doc.text(formatDate(p.fechaPago), cols[0] + 4, y + 5, { width: colW[0] });
    doc.text(concepto, cols[1] + 4, y + 5, { width: colW[1] });
    doc.text(p.nroRecibo || '-', cols[2] + 4, y + 5, { width: colW[2] });
    doc.fillColor(COLORS.green).font(FONTS.bold)
      .text(formatMoney(p.monto), cols[3] + 4, y + 5, { width: colW[3] - 8, align: 'right' });

    totalPagado += p.monto;
    y += 18;
  }

  if (pagos.length === 0) {
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(9)
      .text('Sin pagos registrados', M, y + 10, { width: W, align: 'center' });
    y += 30;
  }

  y += 10;
  hrLine(doc, y);
  y += 8;
  doc.fillColor(COLORS.primary).font(FONTS.bold).fontSize(11)
    .text('TOTAL PAGADO:', M, y, { width: W * 0.7, align: 'right' });
  doc.fillColor(COLORS.green)
    .text(formatMoney(totalPagado), M + W * 0.7, y, { width: W * 0.3, align: 'right' });

  doc.end();
}

// ── ESTADO DE CUENTA DE LA SOCIEDAD ──────────────────────────────────────────
async function generarEstadoSociedad(sociedadId, query, res) {
  const sociedad = await Sociedad.findById(sociedadId);
  if (!sociedad) throw new Error('Sociedad no encontrada');

  const { desde, hasta } = query;
  const filter = { sociedadId };
  if (desde || hasta) {
    filter.fecha = {};
    if (desde) filter.fecha.$gte = new Date(desde);
    if (hasta) { const h = new Date(hasta); h.setHours(23,59,59,999); filter.fecha.$lte = h; }
  }
  const movimientos = await MovimientoSociedad.find(filter).sort({ fecha: 1 });

  const doc = new PDFDocument({ size: 'A4', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="estado_sociedad.pdf"`);
  doc.pipe(res);

  drawHeader(doc, sociedad, 'ESTADO DE CUENTA — INGRESOS Y EGRESOS');

  // M=30 → W = 595.28 - 60 ≈ 535
  // Distribución: FECHA(60) | CONCEPTO(285) | INGRESOS(100) | EGRESOS(W-448) | gap(3)
  const M = 30;
  const W = doc.page.width - M * 2;
  const C_FECHA    = 60;
  const C_CONCEPTO = 285;
  const C_ING      = 100;
  const GAP_DER    = 3;                                          // espacio entre EGRESOS y borde derecho
  const C_EGR      = W - C_FECHA - C_CONCEPTO - C_ING - GAP_DER; // ~87
  const cols = [M, M + C_FECHA, M + C_FECHA + C_CONCEPTO, M + C_FECHA + C_CONCEPTO + C_ING];
  const colW = [C_FECHA, C_CONCEPTO, C_ING, C_EGR];

  let y = 105;

  // Filtro aplicado
  if (desde || hasta) {
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(8)
      .text(`Período: ${desde ? formatDate(desde) : '—'} al ${hasta ? formatDate(hasta) : '—'}`,
            M, y, { width: W });
    y += 16;
  }

  // Cabecera tabla
  doc.rect(M, y, W, 20).fill(COLORS.primary);
  doc.fillColor('white').font(FONTS.bold).fontSize(8);
  doc.text('FECHA',    cols[0] + 4, y + 6, { width: colW[0] });
  doc.text('CONCEPTO', cols[1] + 4, y + 6, { width: colW[1] });
  doc.fillColor('#a7f3d0').font(FONTS.bold)
    .text('INGRESOS', cols[2] + 4, y + 6, { width: colW[2] - 4, align: 'right' });
  doc.fillColor('#fca5a5')
    .text('EGRESOS',  cols[3] + 4, y + 6, { width: colW[3] - 4, align: 'right' });
  y += 20;

  let totalIngresos = 0, totalEgresos = 0;
  let even = true;
  for (const m of movimientos) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      drawHeader(doc, sociedad, 'ESTADO DE CUENTA (cont.)');
      y = 105;
    }

    doc.rect(M, y, W, 18).fill(even ? 'white' : COLORS.light);
    even = !even;

    const esIngreso = m.tipo === 'ingreso';
    // Truncar descripción a 60 caracteres
    const concepto = m.concepto.length > 60
      ? m.concepto.slice(0, 57) + '...'
      : m.concepto;

    doc.fillColor(COLORS.text).font(FONTS.normal).fontSize(8);
    doc.text(formatDate(m.fecha), cols[0] + 4, y + 5, { width: colW[0] });
    doc.text(concepto,            cols[1] + 4, y + 5, { width: colW[1] });

    if (esIngreso) {
      doc.fillColor(COLORS.green).font(FONTS.bold)
        .text(formatMoney(m.monto), cols[2] + 4, y + 5, { width: colW[2] - 8, align: 'right' });
      totalIngresos += m.monto;
    } else {
      doc.fillColor(COLORS.red).font(FONTS.bold)
        .text(formatMoney(m.monto), cols[3] + 4, y + 5, { width: colW[3] - 8, align: 'right' });
      totalEgresos += m.monto;
    }
    y += 18;
  }

  if (movimientos.length === 0) {
    doc.fillColor(COLORS.muted).font(FONTS.italic).fontSize(9)
      .text('Sin movimientos registrados', M, y + 10, { width: W, align: 'center' });
    y += 30;
  }

  y += 10;
  hrLine(doc, y, COLORS.primary);
  y += 10;

  // Resumen
  doc.rect(M, y, W, 60).fill(COLORS.light);
  doc.fillColor(COLORS.green).font(FONTS.bold).fontSize(10)
    .text(`Total ingresos: ${formatMoney(totalIngresos)}`, M + 10, y + 8, { width: W - 20 });
  doc.fillColor(COLORS.red).fontSize(10)
    .text(`Total egresos: ${formatMoney(totalEgresos)}`, M + 10, y + 24, { width: W - 20 });
  const saldo = totalIngresos - totalEgresos;
  doc.fillColor(saldo >= 0 ? COLORS.primary : COLORS.red).fontSize(12)
    .text(`Saldo: ${formatMoney(saldo)}`, M + 10, y + 40, { width: W - 20 });

  doc.end();
}

module.exports = { generarRecibo, generarEstadoCuenta, generarEstadoSociedad };
