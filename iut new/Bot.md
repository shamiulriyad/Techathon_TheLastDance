## Discord Bot — Exact Step-by-Step Tutorial

This bot will live in the **same Node.js process** as your backend (per the architecture requirement: one shared source of truth), reading directly from the `db.js` module we built earlier.

---

## Step 1 — Create the bot in Discord Developer Portal

1. Go to **discord.com/developers/applications** → log in with your Discord account
2. Click **New Application** → name it (e.g. `OfficeWatch Bot`) → Create
3. In the left sidebar, click **Bot**
4. Click **Reset Token** → **Copy** the token immediately (you won't see it again) — save it somewhere temporary, you'll paste it into `.env` in Step 3
5. Scroll down to **Privileged Gateway Intents** → toggle **ON**: `MESSAGE CONTENT INTENT`
   - This is required — without it, discord.js v14 cannot read the text of `!status`, `!room`, etc.
6. Save changes

## Step 2 — Invite the bot to your test server

1. In the left sidebar, click **OAuth2** → **URL Generator**
2. Under **Scopes**, check: `bot`
3. Under **Bot Permissions**, check: `Send Messages`, `Read Message History`, `View Channels`, `Embed Links`
4. Copy the generated URL at the bottom → paste into your browser
5. Select your test server from the dropdown → **Authorize**
6. Confirm the bot now appears (offline) in your server's member list

## Step 3 — Project setup

```bash
npm install discord.js dotenv
```

Create `.env` in your project root (same root as your existing `db.js`, `server.js`):

```
DISCORD_TOKEN=paste_your_bot_token_here
ALERT_CHANNEL_ID=paste_a_channel_id_here
```

Get the channel ID for `ALERT_CHANNEL_ID`: in Discord, enable Developer Mode (User Settings → Advanced → Developer Mode), then right-click any text channel → **Copy Channel ID**.

Add `.env` to `.gitignore` — never commit your token.

## Step 4 — File structure

```
project-root/
 ├─ db.js          (from earlier — devices/readings/alerts queries)
 ├─ simulator.js   (existing device-state simulator)
 ├─ server.js      (existing Express + Socket.IO)
 ├─ bot.js         (new — this tutorial)
 └─ .env
```

## Step 5 — Room alias mapping

The spec's example uses `!room work1`, but your DB stores full names like `"Work Room 1"`. Create this mapping once, at the top of `bot.js`:

```js
const ROOM_ALIASES = {
  drawing: 'Drawing Room',
  work1: 'Work Room 1',
  work2: 'Work Room 2',
};
```

## Step 6 — Build the summary functions (bot.js, part 1)

These call your **existing** `db.js` functions — nothing new is invented, so bot and dashboard always agree.

```js
require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { getAllDevices, getDevicesByRoom, getTodayUsageKwh, getRecentAlerts } = require('./db');

const ROOM_ALIASES = {
  drawing: 'Drawing Room',
  work1: 'Work Room 1',
  work2: 'Work Room 2',
};

function summarizeRoom(devices) {
  const fansOn = devices.filter(d => d.type === 'fan' && d.status === 'on').length;
  const lightsOn = devices.filter(d => d.type === 'light' && d.status === 'on').length;
  if (fansOn === 0 && lightsOn === 0) return 'all off';
  const parts = [];
  if (fansOn > 0) parts.push(`${fansOn} fan${fansOn > 1 ? 's' : ''} ON`);
  if (lightsOn > 0) parts.push(`${lightsOn} light${lightsOn > 1 ? 's' : ''} ON`);
  return parts.join(', ');
}

function buildStatusSummary() {
  const all = getAllDevices();
  const rooms = ['Drawing Room', 'Work Room 1', 'Work Room 2'];
  return rooms
    .map(room => `${room}: ${summarizeRoom(all.filter(d => d.room === room))}`)
    .join('. ');
}

function buildRoomSummary(nameArg) {
  const roomName = ROOM_ALIASES[nameArg?.toLowerCase()];
  if (!roomName) return `I don't recognize that room. Try: drawing, work1, or work2.`;
  const devices = getDevicesByRoom(roomName);
  return `${roomName}: ${summarizeRoom(devices)}.`;
}

function buildUsageSummary() {
  const all = getAllDevices();
  const totalWatts = all.filter(d => d.status === 'on').reduce((sum, d) => sum + d.power_draw_watts, 0);
  const todayKwh = getTodayUsageKwh();
  return `Total power right now: ${totalWatts}W. Today's estimated usage: ${todayKwh} kWh.`;
}

module.exports = { buildStatusSummary, buildRoomSummary, buildUsageSummary };
```

**Validation checkpoint:** before wiring Discord at all, test these three functions in plain Node:

```bash
node -e "console.log(require('./bot').buildStatusSummary())"
```

If this prints a sensible string, your data layer is proven correct *before* Discord is even in the picture — much easier to debug in isolation.

## Step 7 — Add the LLM humanizer (optional but "strongly encouraged" by the spec)

Add this function to `bot.js`. It takes the raw factual string and asks an LLM to rephrase it conversationally — with a hard fallback so a slow/failed API call never breaks the bot.

```js
async function humanize(rawText) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // never let the bot hang

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Rewrite this office-monitoring update as one or two short, friendly sentences. Keep every number exact. Don't add facts that aren't here.\n\n${rawText}`
        }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    return data.content?.[0]?.text || rawText;
  } catch (err) {
    console.error('Humanize failed, falling back to raw text:', err.message);
    return rawText; // graceful fallback — demo never breaks
  }
}
```

Add `ANTHROPIC_API_KEY=your_key` to `.env` if you use this. If you'd rather skip the API dependency for reliability during the live demo, it's completely fine to submit the raw factual strings — the spec says LLM use is "encouraged," not required, and a working, reliable bot beats a flaky fancy one.

## Step 8 — Wire up the Discord client and commands

```js
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  startAlertWatcher(); // Step 9
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // ignore other bots, including itself

  const [command, ...args] = message.content.trim().split(/\s+/);

  try {
    if (command === '!status') {
      const reply = await humanize(buildStatusSummary());
      await message.reply(reply);
    }

    if (command === '!room') {
      const reply = await humanize(buildRoomSummary(args[0]));
      await message.reply(reply);
    }

    if (command === '!usage') {
      const reply = await humanize(buildUsageSummary());
      await message.reply(reply);
    }
  } catch (err) {
    console.error('Command failed:', err);
    await message.reply("Sorry, I couldn't pull that data just now — try again in a moment.");
  }
});

client.login(process.env.DISCORD_TOKEN);
```

## Step 9 — Bonus: proactive alert posting

Reuse your existing alert-checking logic (from the simulator) and post to the designated channel:

```js
function startAlertWatcher() {
  setInterval(() => {
    const recent = getRecentAlerts(1); // most recent alert
    if (!recent.length) return;

    const latest = recent[0];
    const secondsAgo = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;

    // Only announce alerts that were just inserted (avoid re-posting old ones on every tick)
    if (secondsAgo < 35) {
      const channel = client.channels.cache.get(process.env.ALERT_CHANNEL_ID);
      if (channel) channel.send(`⚠️ ${latest.message}`);
    }
  }, 30000); // check every 30s, matching your simulator tick rate
}
```

This assumes your simulator (Step in earlier turns) already calls `insertAlert()` when conditions trigger — the bot just watches the `alerts` table and speaks up when something new lands.

## Step 10 — Run it

```bash
node server.js   # if you required bot.js at the top of server.js, this starts everything together
```

or, if you're keeping it as a separate process during development:

```bash
node bot.js
```

Console should print:
```
Logged in as OfficeWatch Bot#1234
```

If it doesn't log in: double-check `DISCORD_TOKEN` in `.env`, and confirm `MESSAGE CONTENT INTENT` is toggled on in the Developer Portal (Step 1.6) — this is the #1 cause of bots that connect but never respond to messages.

## Step 11 — Test each command exactly against the spec's examples

In your test server's text channel, type:

| You type | Expect something like |
|---|---|
| `!status` | "Drawing Room: 1 fan ON, 2 lights ON. Work Room 1: all off. Work Room 2: 2 fans ON, 3 lights ON." |
| `!room work1` | "Work Room 1: all off." |
| `!usage` | "Total power right now: 740W. Today's estimated usage: 4.2 kWh." |

**Cross-check validation (important for grading):** open your web dashboard in a browser tab at the same moment and confirm the numbers match exactly. This is your proof of the "single source of truth" requirement — take a side-by-side screenshot of the dashboard and the Discord response showing identical numbers, and put it in your README/demo video.

## Step 12 — What to capture for submission

1. Screenshot: `!status`, `!room work1`, `!usage` all answered correctly in Discord
2. Screenshot: dashboard open at the same timestamp, showing matching totals
3. (If you built Step 9) a screenshot of the bot proactively posting an alert unprompted
4. In your demo video: show typing a command live, then cut to the dashboard to prove it's real shared data, not a canned response

That covers every minimum-required command plus both bonus features (humanized responses, proactive alerts) from the spec.