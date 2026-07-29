const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
} = require('discord.js');

const PREFIX = '-';
const LOG_FILE = path.join(__dirname, 'afk.log');

// userId -> { reason: string, since: number (timestamp ms) }
const afkUsers = new Map();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ---------- Logging helper ----------
function logEvent(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFile(LOG_FILE, line + '\n', (err) => {
    if (err) console.error('Failed to write to afk.log:', err);
  });
}

// ---------- Time formatting helper ----------
function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

client.once('ready', () => {
  logEvent(`Bot logged in as ${client.user.tag}. AFK system ready.`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return; // ignore DMs, adjust if you want DM support

  const content = message.content.trim();
  const lower = content.toLowerCase();

  // ----- -afk command -----
  if (lower === '-afk' || lower.startsWith('-afk ')) {
    const reason = content.slice('-afk'.length).trim() || 'AFK';

    afkUsers.set(message.author.id, {
      reason,
      since: Date.now(),
    });

    logEvent(
      `${message.author.tag} (${message.author.id}) went AFK in #${message.channel.name}. Reason: "${reason}"`
    );

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setDescription(
        `💤 **You are now AFK.**\nReason: ${reason}\n\nType \`${PREFIX}endafk\` to come back, or just send a message to auto-clear it.`
      );

    await message.reply({ embeds: [embed] });
    return;
  }

  // ----- -endafk command -----
  if (lower === '-endafk') {
    const entry = afkUsers.get(message.author.id);

    if (!entry) {
      await message.reply("You're not currently AFK.");
      return;
    }

    afkUsers.delete(message.author.id);
    const duration = formatDuration(Date.now() - entry.since);

    logEvent(
      `${message.author.tag} (${message.author.id}) manually ended AFK after ${duration}.`
    );

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setDescription(`👋 **Welcome back!** You were AFK for ${duration}.`);

    await message.reply({ embeds: [embed] });
    return;
  }

  // ----- Auto-clear AFK if the AFK user sends any other message -----
  if (afkUsers.has(message.author.id)) {
    const entry = afkUsers.get(message.author.id);
    afkUsers.delete(message.author.id);
    const duration = formatDuration(Date.now() - entry.since);

    logEvent(
      `${message.author.tag} (${message.author.id}) auto-cleared AFK (sent a message) after ${duration}.`
    );

    message
      .reply(`👋 Welcome back, I've removed your AFK status. (was AFK for ${duration})`)
      .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 8000))
      .catch(() => {});
  }

  // ----- Notify if any mentioned users are AFK -----
  if (message.mentions.users.size > 0) {
    for (const [userId, user] of message.mentions.users) {
      if (afkUsers.has(userId)) {
        const entry = afkUsers.get(userId);
        const duration = formatDuration(Date.now() - entry.since);

        logEvent(
          `${message.author.tag} mentioned AFK user ${user.tag} (${userId}) in #${message.channel.name}.`
        );

        await message.reply(
          `💤 **${user.username}** is AFK: ${entry.reason} — (${duration} ago)`
        );
      }
    }
  }
});

client.login(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE');