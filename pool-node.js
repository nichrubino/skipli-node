import fs from 'fs';
import crypto from 'crypto';

const cfg = JSON.parse(fs.readFileSync('./config.json'));
const DB_FILE = './links.db.json';

var db = JSON.parse(fs.readFileSync(DB_FILE));

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
}

function enforceLimit() {
  db.links.sort((a,b)=>a.created-b.created);
  while (db.totalBytes > cfg.maxDiskBytes && db.links.length) {
    const old = db.links.shift();
    db.totalBytes -= old.size;
  }
}

function addLink(alias, url) {
  if (url.length > cfg.maxUrlLength) {
    url = url.substring(0, cfg.maxUrlLength);
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

console.log('Pool node attivo');
