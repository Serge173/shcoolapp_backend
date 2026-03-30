function requestLogger(req, res, next) {
  const started = Date.now();
  const rid = Math.random().toString(36).slice(2, 10);
  req.requestId = rid;

  res.on('finish', () => {
    const elapsedMs = Date.now() - started;
    const entry = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : (res.statusCode >= 400 ? 'warn' : 'info'),
      requestId: rid,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      elapsedMs,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  });

  next();
}

module.exports = { requestLogger };

