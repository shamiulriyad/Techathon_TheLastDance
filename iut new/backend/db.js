const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'office-state.json');
const ROOMS = ['Drawing Room', 'Work Room 1', 'Work Room 2'];

function createSeedDevices() {
  const now = new Date().toISOString();

  return ROOMS.flatMap((room) => {
    const roomSlug = room.toLowerCase().replace(/\s+/g, '-');
    const fans = Array.from({ length: 2 }, (_item, index) => ({
      id: `${roomSlug}-fan-${index + 1}`,
      name: `Fan ${index + 1}`,
      type: 'fan',
      room,
      status: 'off',
      power_draw_watts: 60,
      last_changed: now
    }));
    const lights = Array.from({ length: 3 }, (_item, index) => ({
      id: `${roomSlug}-light-${index + 1}`,
      name: `Light ${index + 1}`,
      type: 'light',
      room,
      status: 'off',
      power_draw_watts: 15,
      last_changed: now
    }));

    return [...fans, ...lights];
  });
}

function createInitialState() {
  return {
    nextReadingId: 1,
    nextAlertId: 1,
    devices: createSeedDevices(),
    readings: [],
    alerts: []
  };
}

function readState() {
  if (!fs.existsSync(DB_PATH)) {
    const initialState = createInitialState();
    writeState(initialState);
    return initialState;
  }

  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeState(state) {
  fs.writeFileSync(DB_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function sortDevices(devices) {
  return [...devices].sort((a, b) => (
    a.room.localeCompare(b.room) ||
    a.type.localeCompare(b.type) ||
    a.name.localeCompare(b.name)
  ));
}

function getAllDevices() {
  return sortDevices(readState().devices);
}

function getDeviceById(id) {
  return readState().devices.find((device) => device.id === id) || null;
}

function getDevicesByRoom(room) {
  return sortDevices(readState().devices.filter((device) => device.room === room));
}

function updateDeviceStatus(id, status) {
  const state = readState();
  const device = state.devices.find((item) => item.id === id);

  if (!device) {
    throw new Error(`Unknown device id "${id}"`);
  }

  device.status = status;
  device.last_changed = new Date().toISOString();
  writeState(state);

  return device;
}

function getRoomTotals(devices = getAllDevices()) {
  return devices.reduce(
    (totals, device) => {
      const watts = device.status === 'on' ? device.power_draw_watts : 0;
      totals.total += watts;

      if (device.room === 'Drawing Room') {
        totals.drawingRoom += watts;
      }

      if (device.room === 'Work Room 1') {
        totals.work1 += watts;
      }

      if (device.room === 'Work Room 2') {
        totals.work2 += watts;
      }

      return totals;
    },
    { total: 0, drawingRoom: 0, work1: 0, work2: 0 },
  );
}

function logReading(totals) {
  const state = readState();
  state.readings.push({
    id: state.nextReadingId,
    timestamp: new Date().toISOString(),
    total_watts: totals.total,
    drawing_room_watts: totals.drawingRoom,
    work1_watts: totals.work1,
    work2_watts: totals.work2
  });
  state.nextReadingId += 1;
  writeState(state);
}

function getTodayUsageKwh() {
  const state = readState();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const intervalSeconds = Number(process.env.SIM_INTERVAL_MS || 30_000) / 1000;
  const intervalHours = intervalSeconds / 3600;
  const wh = state.readings
    .filter((row) => new Date(row.timestamp) >= start)
    .reduce((sum, row) => sum + row.total_watts * intervalHours, 0);

  return Number((wh / 1000).toFixed(3));
}

function insertAlert(type, room, deviceId, message) {
  const state = readState();
  const alert = {
    id: state.nextAlertId,
    type,
    room,
    device_id: deviceId,
    message,
    timestamp: new Date().toISOString()
  };

  state.alerts.push(alert);
  state.nextAlertId += 1;
  writeState(state);

  return alert;
}

function getRecentAlerts(limit = 20) {
  return [...readState().alerts]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

module.exports = {
  ROOMS,
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
