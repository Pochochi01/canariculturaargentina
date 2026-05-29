const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Error de validación', details: errors });
  }

  if (err.code === 11000 || err.writeErrors?.length > 0) {
    // MongoServerError (save/findOneAndUpdate) tiene keyValue en la raíz.
    // MongoBulkWriteError (insertMany/bulkWrite) lo tiene en writeErrors[0].err.keyValue.
    const keyValue = err.keyValue ?? err.writeErrors?.[0]?.err?.keyValue;
    const field = keyValue ? Object.keys(keyValue)[0] : 'campo';
    return res.status(409).json({ error: `Ya existe un registro con ese ${field}` });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'ID inválido' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
};

module.exports = errorHandler;
