const path = require('path');
const fs   = require('fs');
const PDFDocument = require('pdfkit');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/nomencladores');

// Asegura que el directorio exista
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Parsea CSV simple (codigo,descripcion) — sin biblioteca externa
function parseCSV(content) {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Detectar si la primera línea es cabecera
  const firstCols = lines[0].split(',').map(c => c.trim().toLowerCase());
  const hasHeader = firstCols[0] === 'codigo' || firstCols[0] === 'código' || firstCols[0] === 'code';
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const records = [];
  for (const line of dataLines) {
    const commaIdx = line.indexOf(',');
    if (commaIdx === -1) continue;
    const codigo     = line.slice(0, commaIdx).trim().toUpperCase();
    const descripcion = line.slice(commaIdx + 1).trim().replace(/^"|"$/g, '');
    if (codigo && descripcion) records.push({ codigo, descripcion });
  }
  return records;
}

// POST /api/csv-to-pdf
exports.convertir = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo CSV' });

    const content = req.file.buffer.toString('utf-8');
    const records = parseCSV(content);

    if (records.length === 0) {
      return res.status(422).json({ error: 'No se encontraron registros válidos. El CSV debe tener columnas: codigo,descripcion' });
    }

    // Nombre del PDF basado en el nombre original del CSV
    const baseName  = path.basename(req.file.originalname, path.extname(req.file.originalname));
    const pdfName   = `${baseName}.pdf`;
    const pdfPath   = path.join(UPLOADS_DIR, pdfName);

    await generarPDF(records, pdfPath, baseName);

    res.json({
      ok: true,
      filename: pdfName,
      total: records.length,
      muestra: records.slice(0, 3)
    });
  } catch (err) {
    console.error('[csvToPdf]', err);
    res.status(500).json({ error: err.message });
  }
};

function generarPDF(records, outputPath, titulo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', autoFirstPage: true });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const MARGIN   = 40;
    const PAGE_W   = doc.page.width;   // 595 pt
    const PAGE_H   = doc.page.height;  // 842 pt
    const CONTENT_W = PAGE_W - MARGIN * 2; // 515 pt
    const COLS     = 3;
    const COL_W    = CONTENT_W / COLS; // ~171 pt
    const LINE_H   = 11;
    const FONT_SIZE = 7;
    const HEADER_H  = 70; // espacio reservado para encabezado en primera página
    const TOP_MARGIN = MARGIN + 10;

    // ── Encabezado (primera página) ─────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a1a1a')
       .text(titulo.replace(/_/g, ' ').toUpperCase(), MARGIN, MARGIN, { width: CONTENT_W, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#666666')
       .text(
         `Generado: ${new Date().toLocaleDateString('es-AR')} · ${records.length} registros`,
         MARGIN, MARGIN + 20, { width: CONTENT_W, align: 'center' }
       );
    doc.moveTo(MARGIN, MARGIN + 38).lineTo(PAGE_W - MARGIN, MARGIN + 38)
       .strokeColor('#cccccc').lineWidth(0.5).stroke();

    // ── Posición inicial de datos ────────────────────────────────────────────────
    // En la primera página arrancamos debajo del header; en las siguientes desde TOP_MARGIN
    let pageStartY = MARGIN + HEADER_H;
    let col        = 0;
    let row        = 0;

    const rowsPerCol = (pg) => {
      const availH = PAGE_H - (pg === 0 ? pageStartY : TOP_MARGIN) - MARGIN;
      return Math.floor(availH / LINE_H);
    };

    let currentPage  = 0;
    let maxRowsInCol = rowsPerCol(0);

    doc.font('Courier').fontSize(FONT_SIZE).fillColor('#111111');

    for (const { codigo, descripcion } of records) {
      // Si superamos las filas disponibles en esta columna, avanzar
      if (row >= maxRowsInCol) {
        col++;
        row = 0;
        if (col >= COLS) {
          doc.addPage();
          currentPage++;
          col = 0;
          pageStartY = TOP_MARGIN;
          maxRowsInCol = rowsPerCol(currentPage);
        }
      }

      const xPos = MARGIN + col * COL_W;
      const yBase = currentPage === 0 ? MARGIN + HEADER_H : TOP_MARGIN;
      const yPos  = yBase + row * LINE_H;

      // "CO001  BLANCO NEVADO" — 2 espacios garantizan que el parser lo detecte
      doc.text(`${codigo}  ${descripcion}`, xPos, yPos, {
        width: COL_W - 4,
        lineBreak: false,
        ellipsis: true
      });

      row++;
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

// GET /api/csv-to-pdf/files
exports.listar = (_req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) return res.json([]);
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(f => {
        const stat = fs.statSync(path.join(UPLOADS_DIR, f));
        return { filename: f, size: stat.size, fecha: stat.mtime };
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/csv-to-pdf/download/:filename
exports.descargar = (req, res) => {
  try {
    const filename = path.basename(req.params.filename); // evita path traversal
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    if (!filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Solo se pueden descargar archivos PDF' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/csv-to-pdf/:filename
exports.eliminar = (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
    if (!filename.endsWith('.pdf')) return res.status(400).json({ error: 'Solo se pueden eliminar PDFs' });

    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
