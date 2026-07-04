const {
  ROOMS,
  getAllDevices,
  getDeviceById,
  getDevicesByRoom: getDbDevicesByRoom,
  getRecentAlerts,
  getRoomTotals,
  getTodayUsageKwh,
  insertAlert,
  logReading,
  updateDeviceStatus,
} = require('./db');

const ROOM_ALIASES = {
  drawing: 'Drawing Room',
  draw: 'Drawing Room',
  'drawing room': 'Drawing Room',
  work1: 'Work Room 1',
  'work 1': 'Work Room 1',
  'work room 1': 'Work Room 1',
  wr1: 'Work Room 1',
  work2: 'Work Room 2',
  'work 2': 'Work Room 2',
  'work room 2': 'Work Room 2',
  wr2: 'Work Room 2',
};

function getActiveWatts(device) {
  return device.status === 'on' ? device.power_draw_watts : 0;
}

function getDevices() {
  return getAllDevices();
}

function resolveRoomName(input = '') {
  const normalized = String(input).trim().toLowerCase();
  return ROOM_ALIASES[normalized] || ROOMS.find((room) => room.toLowerCase() === normalized) || null;
}

function getDevicesByRoom(roomName) {
  const room = resolveRoomName(roomName);
  return room ? getDbDevicesByRoom(room) : [];
}

function setDeviceStatus(id, status) {
  if (!['on', 'off'].includes(status)) {
    throw new Error(`Invalid status "${status}" for device ${id}`);
  }

  return updateDeviceStatus(id, status);
}

function toggleDevice(id) {
  const device = getDeviceById(id);
  if (!device) {
    throw new Error(`Unknown device id "${id}"`);
  }

  return setDeviceStatus(id, device.status === 'on' ? 'off' : 'on');
}

function toggleDevices(ids) {
  return ids.map((id) => toggleDevice(id));
}

function getRoomSummaries() {
  const state = getDevices();

  return ROOMS.map((room) => {
    const roomDevices = state.filter((device) => device.room === room);
    const fansOn = roomDevices.filter((device) => device.type === 'fan' && device.status === 'on').length;
    const lightsOn = roomDevices.filter((device) => device.type === 'light' && device.status === 'on').length;
    const powerWatts = roomDevices.reduce((total, device) => total + getActiveWatts(device), 0);

    return {
      room,
      fansOn,
      lightsOn,
      powerWatts,
      allOff: fansOn === 0 && lightsOn === 0,
    };
  });
}

function getPowerMetrics() {
  const roomBreakdown = getRoomSummaries().map(({ room, powerWatts }) => ({ room, powerWatts }));

  return {
    totalPowerWatts: roomBreakdown.reduce((total, room) => total + room.powerWatts, 0),
    estimatedKwhToday: getTodayUsageKwh(),
    roomBreakdown,
  };
}

function formatRoomSummary(roomSummary) {
  if (roomSummary.allOff) {
    return `${roomSummary.room}: all off`;
  }

  const fanLabel = roomSummary.fansOn === 1 ? 'fan' : 'fans';
  const lightLabel = roomSummary.lightsOn === 1 ? 'light' : 'lights';
  return `${roomSummary.room}: ${roomSummary.fansOn} ${fanLabel} ON, ${roomSummary.lightsOn} ${lightLabel} ON`;
}

function getStatusMessage() {
  return `${getRoomSummaries().map(formatRoomSummary).join('. ')}.`;
}

function getRoomStatusMessage(roomName) {
  const room = resolveRoomName(roomName);
  if (!room) {
    return `I could not find that room. Try drawing, work1, or work2.`;
  }

  const summary = getRoomSummaries().find((roomSummary) => roomSummary.room === room);
  const activeDevices = getDevices()
    .filter((device) => device.room === room && device.status === 'on')
    .map((device) => `${device.name} (${device.power_draw_watts}W)`);

  const deviceSentence = activeDevices.length ? ` Active now: ${activeDevices.join(', ')}.` : ' No devices are drawing power.';
  return `${formatRoomSummary(summary)}.${deviceSentence}`;
}

function getUsageMessage() {
  const metrics = getPowerMetrics();
  const breakdown = metrics.roomBreakdown.map((room) => `${room.room}: ${room.powerWatts}W`).join(', ');

  return `Total power right now: ${metrics.totalPowerWatts}W. Today's estimated usage: ${metrics.estimatedKwhToday.toFixed(
    2,
  )} kWh. ${breakdown}.`;
}

function buildAlertRows(now = new Date()) {
  const afterOfficeHours = now.getHours() < 9 || now.getHours() >= 17;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  const state = getDevices();
  const alerts = [];

  if (afterOfficeHours) {
    state
      .filter((device) => device.status === 'on')
      .forEach((device) => {
        alerts.push({
          type: 'after_hours',
          room: device.room,
          device_id: device.id,
          message: `${device.name} in ${device.room} was left on after office hours.`,
        });
      });
  }

  ROOMS.forEach((room) => {
    const runningDevices = state.filter((device) => device.room === room && device.status === 'on');
    if (!runningDevices.length) {
      return;
    }

    const oldestActiveSince = Math.min(...runningDevices.map((device) => new Date(device.last_changed).getTime()));
    if (now.getTime() - oldestActiveSince > twoHoursMs) {
      alerts.push({
        type: 'continuous_2hr',
        room,
        device_id: null,
        message: `${room} has had devices continuously on for more than 2 hours.`,
      });
    }
  });

  return alerts;
}

function logCurrentReadingAndAlerts(now = new Date()) {
  const devices = getDevices();
  const totals = getRoomTotals(devices);
  const alerts = buildAlertRows(now);

  logReading(totals);
  alerts.forEach((alert) => {
    insertAlert(alert.type, alert.room, alert.device_id, alert.message);
  });

  return {
    devices,
    totals,
    alerts: getRecentAlerts(),
  };
}

function getLongRunningAlerts(now = new Date()) {
  return buildAlertRows(now).map((alert) => ({
    key: `${alert.type}:${alert.device_id || alert.room}`,
    severity: alert.type === 'continuous_2hr' ? 'critical' : 'warning',
    message: alert.message,
    timestamp: now.toISOString(),
  }));
}

module.exports = {
  ROOMS,
  getDevices,
  getDevicesByRoom,
  getLongRunningAlerts,
  getPowerMetrics,
  getRecentAlerts,
  getRoomStatusMessage,
  getRoomSummaries,
  getStatusMessage,
  getUsageMessage,
  logCurrentReadingAndAlerts,
  resolveRoomName,
  setDeviceStatus,
  toggleDevice,
  toggleDevices,
};
