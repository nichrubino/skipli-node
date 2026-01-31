const fs = require('fs');
const WebSocket = require('ws');

var CONFIG = {
  port: 8080,
  maxDiskBytes: 20 * 1024 * 1024 * 1024,
  maxUrlLength: 100000,
  dbFile: './links.db.json'
};

if (!fs.existsSync(CONFIG.dbFile)) {
  fs.writeFileSync(CONFIG.dbFile, JSON.stringify({ totalBytes: 0, links: [] }));
}

var db = JSON.parse(fs.readFileSync(CONFIG.dbFile));

function saveDb() {
  fs.writeFileSync(CONFIG.dbFile, JSON.stringify(db));
}

function enforceLimit() {
  db.links.sort(function(a,b){ return a.created - b.created });
  while (db.totalBytes > CONFIG.maxDiskBytes && db.links.length) {
    var old = db.links.shift();
    db.totalBytes -= old.size;
  }
}

function addLink(alias, url, hash) {
  if (url.length > CONFIG.maxUrlLength) {
    url = url.substring(0, CONFIG.maxUrlLength);
  }

  var size = Buffer.byteLength(url);

  db.links = db.links.filter(function(l){ return l.alias !== alias });

  db.links.push({
    alias: alias,
    url: url,
    hash: hash || null,
    size: size,
    created: Date.now()
  });

  db.totalBytes += size;
  enforceLimit();
  saveDb();
}

function getLink(alias) {
  return db.links.find(function(l){ return l.alias === alias });
}

var wss = new WebSocket.Server({ port: CONFIG.port });

wss.on('connection', function(ws) {
  ws.on('message', function(msg) {
    var data;
    try { data = JSON.parse(msg); } catch { return; }

    if (data.type === 'new') {
      if (!data.alias || !data.url) return;
      addLink(data.alias, data.url, data.hash);
      ws.send(JSON.stringify({ type: 'stored', alias: data.alias }));
      return;
    }

    if (data.type === 'get') {
      var link = getLink(data.alias);
      ws.send(JSON.stringify({
        type: 'result',
        alias: data.alias,
        url: link ? link.url : null,
        hash: link ? link.hash : null
      }));
      return;
    }
  });
});

console.log('🚀 Skipli pool ATTIVA sulla porta', CONFIG.port);
