const { getDevices, logCurrentReadingAndAlerts, toggleDevices } = require('./store');

const DEFAULT_INTERVAL_MS = 30_000;
const MIN_INTERVAL_MS = 5_000;
const MAX_INTERVAL_MS = 60_000;

function getIntervalMs() {
  const requestedInterval = Number(process.env.SIM_INTERVAL_MS || DEFAULT_INTERVAL_MS);
  if (Number.isNaN(requestedInterval)) {
    return DEFAULT_INTERVAL_MS;
  }

  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, requestedInterval));
}

function pickRandomDevices(devices, count) {
  const shuffled = [...devices].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function startSimulator(onUpdate) {
  const intervalMs = getIntervalMs();

  const timer = setInterval(() => {
    const currentDevices = getDevices();
    const toggleCount = Math.random() > 0.65 ? 2 : 1;
    const selectedIds = pickRandomDevices(currentDevices, toggleCount).map((device) => device.id);

    toggleDevices(selectedIds);
    const snapshot = logCurrentReadingAndAlerts();
    onUpdate(snapshot.devices, selectedIds, snapshot.alerts, snapshot.totals);
  }, intervalMs);

  return {
    intervalMs,
    stop: () => clearInterval(timer),
  };
}

module.exports = {
  startSimulator,
};
