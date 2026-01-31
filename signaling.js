import { WebSocketServer } from 'ws';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync('./config.json'));
const wss = new WebSocketServer({ port: cfg.signalingPort });

const rooms = {};

wss.on('connection', ws => {
  ws.on('message', msg => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    if (data.type === 'join') {
      ws.room = data.room;
      ws.id = data.id;

      rooms[ws.room] ||= { peers: [], host: null };
      rooms[ws.room].peers.push(ws);

      if (!rooms[ws.room].host) {
        rooms[ws.room].host = ws.id;
      }

      ws.send(JSON.stringify({
        type: 'joined',
        hostId: rooms[ws.room].host
      }));
    }

    if (data.to) {
      const r = rooms[ws.room];
      if (!r) return;
      const peer = r.peers.find(p => p.id === data.to);
      if (peer) peer.send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    const r = rooms[ws.room];
    if (!r) return;

    r.peers = r.peers.filter(p => p !== ws);

    if (r.host === ws.id && r.peers.length) {
      r.host = r.peers[0].id;
      r.peers.forEach(p =>
        p.send(JSON.stringify({ type:'host', id:r.host }))
      );
    }
  });
});

console.log('Signaling server attivo');
