## Which "database" fits this project

The spec explicitly allows: *"a script, an in-memory store, a JSON file with a simulator, or a small database."* Given you need **real-time push updates** (Socket.IO) plus a bit of **history** (for `!usage`'s "today's estimated kWh" and for alert timestamps to survive if you restart the server), the best fit is:

- **In-memory JS object** = live/current state (source of truth the dashboard and bot both read every second)
- **SQLite** (via `better-sqlite3`) = a lightweight persistent log of readings + alerts, so usage stats and alert history don't vanish on restart

This is one file, zero server setup, and still counts as "a small database" for grading purposes.

## 1. Install

```bash
npm install better-sqlite3
```

No server, no Docker — it's a single `.db` file on disk.

## 2. Exact schema

Create `db.js`:

```js
const Database = require('better-sqlite3');
const db = new Database('office.db');

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

module.exports = db;
```

**Why three tables:**
- `devices` — current state, one row per device, this is what gets updated every simulator tick
- `readings` — a snapshot log written every tick, so you can sum wattage over time → estimated kWh for `!usage`
- `alerts` — every time an alert condition fires, log it (timestamped, per the spec's requirement)

## 3. Seed the 18 devices (exact format)

```js
const rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2'];
const insert = db.prepare(`
  INSERT OR IGNORE INTO devices (id, name, type, room, status, power_draw_watts, last_changed)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const now = new Date().toISOString();
rooms.forEach(room => {
  const roomSlug = room.toLowerCase().replace(/\s+/g, '-');
  for (let i = 1; i <= 2; i++) {
    insert.run(`${roomSlug}-fan-${i}`, `Fan ${i}`, 'fan', room, 'off', 60, now);
  }
  for (let i = 1; i <= 3; i++) {
    insert.run(`${roomSlug}-light-${i}`, `Light ${i}`, 'light', room, 'off', 15, now);
  }
});
```

This gives you exactly 18 rows: `drawing-room-fan-1`, `drawing-room-fan-2`, `drawing-room-light-1/2/3`, `work-room-1-fan-1/2`, `work-room-1-light-1/2/3`, `work-room-2-fan-1/2`, `work-room-2-light-1/2/3`.

## 4. Exact row/JSON format

A single device row looks like this everywhere in the app (DB row → API response → Socket.IO payload — same shape, no translation needed):

```json
{
  "id": "work-room-1-fan-1",
  "name": "Fan 1",
  "type": "fan",
  "room": "Work Room 1",
  "status": "on",
  "power_draw_watts": 60,
  "last_changed": "2026-07-03T14:32:00.000Z"
}
```

A `readings` row (written once per simulator tick, e.g. every 30s):

```json
{
  "timestamp": "2026-07-03T14:32:00.000Z",
  "total_watts": 740,
  "drawing_room_watts": 210,
  "work1_watts": 240,
  "work2_watts": 290
}
```

An `alerts` row:

```json
{
  "type": "after_hours",
  "room": "Work Room 2",
  "device_id": "work-room-2-fan-1",
  "message": "Fan 1 in Work Room 2 was left on after office hours.",
  "timestamp": "2026-07-03T22:14:00.000Z"
}
```

## 5. The functions everything else calls

Add these to `db.js` (or a `queries.js`) — the API, Socket.IO emitter, simulator, and Discord bot **all call these same functions**, which is what satisfies the "single source of truth" requirement:

```js
function getAllDevices() {
  return db.prepare('SELECT * FROM devices').all();
}

function getDevicesByRoom(room) {
  return db.prepare('SELECT * FROM devices WHERE room = ?').all(room);
}

function updateDeviceStatus(id, status) {
  db.prepare(`
    UPDATE devices SET status = ?, last_changed = ? WHERE id = ?
  `).run(status, new Date().toISOString(), id);
}

function logReading(totals) {
  db.prepare(`
    INSERT INTO readings (timestamp, total_watts, drawing_room_watts, work1_watts, work2_watts)
    VALUES (?, ?, ?, ?, ?)
  `).run(new Date().toISOString(), totals.total, totals.drawingRoom, totals.work1, totals.work2);
}

function getTodayUsageKwh() {
  const start = new Date(); start.setHours(0,0,0,0);
  const rows = db.prepare('SELECT total_watts FROM readings WHERE timestamp >= ?').all(start.toISOString());
  // each reading represents ~30s of draw; sum(W) * (interval_hours) = Wh, /1000 = kWh
  const intervalHours = 30 / 3600;
  const wh = rows.reduce((sum, r) => sum + r.total_watts * intervalHours, 0);
  return (wh / 1000).toFixed(2);
}

function insertAlert(type, room, deviceId, message) {
  db.prepare(`
    INSERT INTO alerts (type, room, device_id, message, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(type, room, deviceId, message, new Date().toISOString());
}

function getRecentAlerts(limit = 20) {
  return db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?').all(limit);
}

module.exports = { getAllDevices, getDevicesByRoom, updateDeviceStatus, logReading, getTodayUsageKwh, insertAlert, getRecentAlerts };
```

## 6. How each piece uses it

| Piece | Calls |
|---|---|
| Simulator (every 30s) | picks a random device → `updateDeviceStatus()` → recomputes totals → `logReading()` → checks alert conditions → `insertAlert()` if triggered → emits via Socket.IO |
| REST API `/api/devices` | `getAllDevices()` → returns JSON array |
| REST API `/api/usage` | sums current `getAllDevices()` for live watts + `getTodayUsageKwh()` for the kWh estimate |
| REST API `/api/alerts` | `getRecentAlerts()` |
| Socket.IO emit | same `getAllDevices()` + computed totals, pushed to all connected dashboard clients |
| Discord bot `!status` / `!room` / `!usage` | calls the exact same functions directly (same process, no HTTP round-trip needed) |

That's the whole database layer — one file, ~60 lines, no external server, and it directly produces the exact JSON shapes your dashboard and bot need.