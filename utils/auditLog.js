const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
const auditFile = path.join(logsDir, 'audit.log');

function ensureDir() {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
}

function writeAudit(event, data = {}) {
  try {
    ensureDir();
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...data,
    });
    fs.appendFileSync(auditFile, `${line}\n`, 'utf8');
  } catch (err) {
    console.error('Audit logging error:', err.message);
  }
}

module.exports = { writeAudit };

