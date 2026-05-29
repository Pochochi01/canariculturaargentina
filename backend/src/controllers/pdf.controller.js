const pdfService = require('../services/pdf.service');

const wrapPdf = (fn) => async (req, res, next) => {
  try {
    await fn(req.params.competenciaId, res);
  } catch (err) {
    if (!res.headersSent) return next(err);
    console.error('Error generando PDF:', err.message);
    res.end();
  }
};

exports.catalogo              = wrapPdf(pdfService.generarCatalogo);
exports.planillaJura          = wrapPdf(pdfService.generarPlanillaJura);
exports.listadoLote           = wrapPdf(pdfService.generarListadoLote);
exports.listadoSocio          = wrapPdf(pdfService.generarListadoSocio);
exports.listadoVariedadSociedad = wrapPdf(pdfService.generarListadoVariedadSociedad);

// El certificado necesita el userId del usuario autenticado además del competenciaId
exports.certificado = async (req, res, next) => {
  try {
    await pdfService.generarCertificado(req.params.competenciaId, req.user._id, res);
  } catch (err) {
    if (!res.headersSent) return next(err);
    console.error('Error generando certificado:', err.message);
    res.end();
  }
};
