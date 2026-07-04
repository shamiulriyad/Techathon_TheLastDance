require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Server } = require('socket.io');
const { startSimulator } = require('./simulator');
const {
  getDevices,
  getLongRunningAlerts,
  getPowerMetrics,
  getRecentAlerts,
  getRoomStatusMessage,
  getStatusMessage,
  getUsageMessage,
  toggleDevice,
} = require('./store');

const PORT = Number(process.env.PORT || 5000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_ALERT_CHANNEL_ID = process.env.DISCORD_ALERT_CHANNEL_ID;
const ALERT_CHECK_INTERVAL_MS = Number(process.env.ALERT_CHECK_INTERVAL_MS || 60_000);
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS || 30 * 60_000);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

const recentDiscordAlerts = new Map();

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

function createDiscordClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });
}

function normalizeCommand(content) {
  const [command, ...args] = content.trim().split(/\s+/);
  return {
    command: command.toLowerCase(),
    args,
  };
}

async function handleDiscordCommand(message) {
  if (message.author.bot || !message.content.startsWith('!')) {
    return;
  }

  const { command, args } = normalizeCommand(message.content);

  if (command === '!status') {
    await message.reply(getStatusMessage());
    return;
  }

  if (command === '!room') {
    await message.reply(getRoomStatusMessage(args.join(' ')));
    return;
  }

  if (command === '!usage') {
    await message.reply(getUsageMessage());
    return;
  }

  if (command === '!help') {
    await message.reply('Try `!status`, `!room work1`, or `!usage` for the live office picture.');
  }
}

function shouldSendAlert(alert, now) {
  const lastSentAt = recentDiscordAlerts.get(alert.key);
  if (!lastSentAt || now.getTime() - lastSentAt > ALERT_COOLDOWN_MS) {
    recentDiscordAlerts.set(alert.key, now.getTime());
    return true;
  }

  return false;
}

async function sendDiscordAlerts(client) {
  if (!DISCORD_ALERT_CHANNEL_ID) {
    return;
  }

  const now = new Date();
  const alerts = getLongRunningAlerts(now).filter((alert) => shouldSendAlert(alert, now));
  if (!alerts.length) {
    return;
  }

  const channel = await client.channels.fetch(DISCORD_ALERT_CHANNEL_ID).catch((error) => {
    console.error('Could not fetch Discord alert channel:', error.message);
    return null;
  });

  if (!channel || !channel.isTextBased()) {
    return;
  }

  await Promise.all(alerts.map((alert) => channel.send(`Office energy alert: ${alert.message}`)));
}

function startDiscordBot() {
  if (!DISCORD_TOKEN) {
    console.warn('DISCORD_TOKEN is not set. Backend is running without the Discord bot.');
    return null;
  }

  const client = createDiscordClient();

  client.once('ready', () => {
    console.log(`Discord bot signed in as ${client.user.tag}`);
    setInterval(() => {
      sendDiscordAlerts(client).catch((error) => {
        console.error('Discord alert loop failed:', error);
      });
    }, ALERT_CHECK_INTERVAL_MS);
  });

  client.on('messageCreate', (message) => {
    handleDiscordCommand(message).catch((error) => {
      console.error('Discord command failed:', error);
    });
  });

  client.login(DISCORD_TOKEN).catch((error) => {
    console.error('Discord login failed:', error.message);
  });

  return client;
}

startSimulator((updatedState, changedIds, alerts) => {
  console.log(`Simulator toggled: ${changedIds.join(', ')}`);
  io.emit('deviceUpdate', updatedState);
  io.emit('usageUpdate', getPowerMetrics());
  io.emit('alertsUpdate', alerts || getRecentAlerts());
});

startDiscordBot();

server.listen(PORT, () => {
  console.log(`IoT office backend listening on http://localhost:${PORT}`);
  broadcastDeviceState();
});
