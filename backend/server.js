const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { startDiscordBot } = require('./bot');
const { startSimulator } = require('./simulator');
const {
  getDevices,
  getPowerMetrics,
  getRecentAlerts,
  toggleDevice,
} = require('./store');

const PORT = Number(process.env.PORT || 5000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, devices: getDevices().length });
});

app.get('/api/devices', (_req, res) => {
  res.json(getDevices());
});

app.get('/api/usage', (_req, res) => {
  res.json(getPowerMetrics());
});

app.get('/api/alerts', (_req, res) => {
  res.json(getRecentAlerts());
});

app.patch('/api/devices/:id/toggle', (req, res) => {
  try {
    const device = toggleDevice(req.params.id);
    broadcastDeviceState();
    res.json(device);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  socket.emit('deviceUpdate', getDevices());
  socket.emit('usageUpdate', getPowerMetrics());
  socket.emit('alertsUpdate', getRecentAlerts());

  socket.on('toggleDevice', (deviceId, acknowledge) => {
    try {
      const device = toggleDevice(deviceId);
      broadcastDeviceState();
      acknowledge?.({ ok: true, device });
    } catch (error) {
      acknowledge?.({ ok: false, error: error.message });
    }
  });
});

function broadcastDeviceState() {
  io.emit('deviceUpdate', getDevices());
  io.emit('usageUpdate', getPowerMetrics());
  io.emit('alertsUpdate', getRecentAlerts());
}

function startBackendServices() {
  startSimulator((updatedState, changedIds, alerts) => {
    console.log(`Simulator toggled: ${changedIds.join(', ')}`);
    io.emit('deviceUpdate', updatedState);
    io.emit('usageUpdate', getPowerMetrics());
    io.emit('alertsUpdate', alerts || getRecentAlerts());
  });

  startDiscordBot();
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the existing backend process, or set PORT to another value in backend/.env.`,
    );
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, () => {
  console.log(`IoT office backend listening on http://localhost:${PORT}`);
  broadcastDeviceState();
  startBackendServices();
});
