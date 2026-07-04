const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Client, GatewayIntentBits } = require('discord.js');
const { getAllDevices, getDevicesByRoom, getRecentAlerts, getTodayUsageKwh } = require('./db');

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

function summarizeRoom(devices) {
  const fansOn = devices.filter((device) => device.type === 'fan' && device.status === 'on').length;
  const lightsOn = devices.filter((device) => device.type === 'light' && device.status === 'on').length;

  if (fansOn === 0 && lightsOn === 0) {
    return 'all off';
  }

  const parts = [];
  if (fansOn > 0) parts.push(`${fansOn} fan${fansOn > 1 ? 's' : ''} ON`);
  if (lightsOn > 0) parts.push(`${lightsOn} light${lightsOn > 1 ? 's' : ''} ON`);

  return parts.join(', ');
}

function buildStatusSummary() {
  const allDevices = getAllDevices();
  const rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2'];

  return rooms.map((room) => `${room}: ${summarizeRoom(allDevices.filter((device) => device.room === room))}`).join('. ');
}

function buildRoomSummary(nameArg) {
  const roomName = ROOM_ALIASES[String(nameArg || '').toLowerCase()];

  if (!roomName) {
    return `I don't recognize that room. Try: drawing, work1, or work2.`;
  }

  return `${roomName}: ${summarizeRoom(getDevicesByRoom(roomName))}.`;
}

function buildUsageSummary() {
  const allDevices = getAllDevices();
  const totalWatts = allDevices
    .filter((device) => device.status === 'on')
    .reduce((sum, device) => sum + device.power_draw_watts, 0);
  const todayKwh = getTodayUsageKwh();

  return `Total power right now: ${totalWatts}W. Today's estimated usage: ${Number(todayKwh).toFixed(2)} kWh.`;
}

async function humanize(rawText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return rawText;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: `Rewrite this office-monitoring update as one or two short, friendly sentences. Keep every number exact. Don't add facts that aren't here.\n\n${rawText}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return rawText;
    }

    const data = await response.json();
    return data.content?.[0]?.text || rawText;
  } catch (error) {
    console.error('Humanize failed, falling back to raw text:', error.message);
    return rawText;
  }
}

function createDiscordClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

async function handleDiscordCommand(message) {
  if (message.author.bot) return;

  const [command, ...args] = message.content.trim().split(/\s+/);

  try {
    if (command === '!status') {
      await message.reply(await humanize(buildStatusSummary()));
      return;
    }

    if (command === '!room') {
      await message.reply(await humanize(buildRoomSummary(args[0])));
      return;
    }

    if (command === '!usage') {
      await message.reply(await humanize(buildUsageSummary()));
      return;
    }

    if (command === '!help') {
      await message.reply('Try `!status`, `!room work1`, or `!usage` for the live office picture.');
    }
  } catch (error) {
    console.error('Discord command failed:', error);
    await message.reply("Sorry, I couldn't pull that data just now - try again in a moment.");
  }
}

function startAlertWatcher(client) {
  const channelId = process.env.ALERT_CHANNEL_ID || process.env.DISCORD_ALERT_CHANNEL_ID;
  let lastPostedAlertId = null;

  if (!channelId) {
    return null;
  }

  return setInterval(() => {
    const recent = getRecentAlerts(1);
    if (!recent.length) return;

    const latest = recent[0];
    const secondsAgo = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;

    if (latest.id !== lastPostedAlertId && secondsAgo < 35) {
      lastPostedAlertId = latest.id;
      const channel = client.channels.cache.get(channelId);
      if (channel?.isTextBased()) {
        channel.send(`Office energy alert: ${latest.message}`).catch((error) => {
          console.error('Discord alert send failed:', error.message);
        });
      }
    }
  }, 30_000);
}

function startDiscordBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.warn('DISCORD_TOKEN is not set. Backend is running without the Discord bot.');
    return null;
  }

  const client = createDiscordClient();

  client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
    startAlertWatcher(client);
  });

  client.on('messageCreate', (message) => {
    handleDiscordCommand(message).catch((error) => {
      console.error('Discord command failed:', error);
    });
  });

  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('Discord login failed:', error.message);
  });

  return client;
}

if (require.main === module) {
  startDiscordBot();
}

module.exports = {
  buildRoomSummary,
  buildStatusSummary,
  buildUsageSummary,
  handleDiscordCommand,
  humanize,
  startDiscordBot,
};
