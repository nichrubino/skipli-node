const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws');

/* ===== CONFIG ===== */

const CONFIG = {
  port: 8080,
  maxDiskBytes: 20 * 1024 * 1024 * 1024,
  maxUrlLength: 100000,
  dbFile: './links.db.json'
};

/* ===== STORAGE ===== */

if (!fs.existsSync(CONFIG.dbFile)) {
  fs.writeFileSync(CONFIG.dbFile, JSON.stringify({ totalBytes: 0, links: [] }));
}

var db = JSON.parse(fs.readFileSync(CONFIG.dbFile));

function saveDb() {
  fs.writeFileSync(CONFIG.dbFile, JSON.stringify(db));
}

function enforceLimit() {
  db.links.sort((a, b) => a.created - b.created);
  while (db.totalBytes > CONFIG.maxDiskBytes && db.links.length) {
    const old = db.links.shift();
    db.totalBytes -= old.size;
  }
}

function addLink(alias, url) {
  if (url.length > CONFIG.maxUrlLength) {
    url = url.substring(0, CONFIG.maxUrlLength);
  }

  const size = Buffer.byteLength(url);

  db.links.push({
    alias,
    url,
    size,
    created: Date.now()
  });

  db.totalBytes += size;
  enforceLimit();
  saveDb();
}

function getLink(alias) {
  return db.links.find(l => l.alias === alias);
}

/* ===== SERVER ===== */

const wss = new WebSocket.Server({ port: CONFIG.port });

wss.on('connection', ws => {
  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    if (data.type === 'store') {
      addLink(data.alias, data.url);
      ws.send(JSON.stringify({ type: 'stored', alias: data.alias }));
    }

    if (data.type === 'get') {
      const link = getLink(data.alias);
      ws.send(JSON.stringify({
        type: 'result',
        alias: data.alias,
        url: link ? link.url : null
      }));
    }
  });
});

console.log('🚀 Skipli pool ATTIVA sulla porta', CONFIG.port);
