const path = require('path');
const Database = require('better-sqlite3');

const ROOMS = ['Drawing Room', 'Work Room 1', 'Work Room 2'];
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'office.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('fan','light')),
  room TEXT NOT NULL CHECK(room IN ('Drawing Room','Work Room 1','Work Room 2')),
  status TEXT NOT NULL CHECK(status IN ('on','off')),
  power_draw_watts INTEGER NOT NULL,
  last_changed TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  total_watts INTEGER NOT NULL,
  drawing_room_watts INTEGER NOT NULL,
  work1_watts INTEGER NOT NULL,
  work2_watts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('after_hours','continuous_2hr')),
  room TEXT,
  device_id TEXT,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
`);

function seedDevices() {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO devices (id, name, type, room, status, power_draw_watts, last_changed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const now = new Date().toISOString();

  const seed = db.transaction(() => {
    ROOMS.forEach((room) => {
      const roomSlug = room.toLowerCase().replace(/\s+/g, '-');

      for (let index = 1; index <= 2; index += 1) {
        insert.run(`${roomSlug}-fan-${index}`, `Fan ${index}`, 'fan', room, 'off', 60, now);
      }

      for (let index = 1; index <= 3; index += 1) {
        insert.run(`${roomSlug}-light-${index}`, `Light ${index}`, 'light', room, 'off', 15, now);
      }
    });
  });

  seed();
}

seedDevices();

const deviceOrderSql = `
  ORDER BY
    CASE room
      WHEN 'Drawing Room' THEN 1
      WHEN 'Work Room 1' THEN 2
      WHEN 'Work Room 2' THEN 3
      ELSE 4
    END,
    CASE type WHEN 'fan' THEN 1 WHEN 'light' THEN 2 ELSE 3 END,
    name
`;

function getAllDevices() {
  return db.prepare(`SELECT * FROM devices ${deviceOrderSql}`).all();
}

function getDeviceById(id) {
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id) || null;
}

function getDevicesByRoom(room) {
  return db.prepare(`SELECT * FROM devices WHERE room = ? ${deviceOrderSql}`).all(room);
}

function updateDeviceStatus(id, status) {
  const result = db.prepare(`
    UPDATE devices SET status = ?, last_changed = ? WHERE id = ?
  `).run(status, new Date().toISOString(), id);

  if (result.changes === 0) {
    throw new Error(`Unknown device id "${id}"`);
  }

  return getDeviceById(id);
}

function getRoomTotals(devices = getAllDevices()) {
  return devices.reduce(
    (totals, device) => {
      const watts = device.status === 'on' ? device.power_draw_watts : 0;
      totals.total += watts;

      if (device.room === 'Drawing Room') totals.drawingRoom += watts;
      if (device.room === 'Work Room 1') totals.work1 += watts;
      if (device.room === 'Work Room 2') totals.work2 += watts;

      return totals;
    },
    { total: 0, drawingRoom: 0, work1: 0, work2: 0 },
  );
}

function logReading(totals) {
  return db.prepare(`
    INSERT INTO readings (timestamp, total_watts, drawing_room_watts, work1_watts, work2_watts)
    VALUES (?, ?, ?, ?, ?)
  `).run(new Date().toISOString(), totals.total, totals.drawingRoom, totals.work1, totals.work2);
}

function getTodayUsageKwh() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = db.prepare('SELECT total_watts FROM readings WHERE timestamp >= ?').all(start.toISOString());
  const intervalHours = Number(process.env.SIM_INTERVAL_MS || 30_000) / 1000 / 3600;
  const wh = rows.reduce((sum, row) => sum + row.total_watts * intervalHours, 0);

  return Number((wh / 1000).toFixed(3));
}

function insertAlert(type, room, deviceId, message) {
  const result = db.prepare(`
    INSERT INTO alerts (type, room, device_id, message, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, room, deviceId, message, new Date().toISOString());

  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
}

function getRecentAlerts(limit = 20) {
  return db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?').all(limit);
}

module.exports = {
  ROOMS,
  db,
  getAllDevices,
  getDeviceById,
  getDevicesByRoom,
  getRecentAlerts,
  getRoomTotals,
  getTodayUsageKwh,
  insertAlert,
  logReading,
  updateDeviceStatus,
};
