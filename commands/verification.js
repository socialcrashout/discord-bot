/**
 * .mode Verification System — commands/verification.js
 * -------------------------------------------------------
 * Fits your existing command-handler pattern: this file exports
 * { data, execute } like your other files in commands/ (ban.js,
 * kick.js, etc). It does NOT create its own client, does NOT
 * call client.login, and does NOT register commands itself —
 * your existing loader/registration script already does that for
 * every file in commands/, and doing it again here is what wiped
 * your other slash commands last time.
 *
 * FLOW (backed live by the Dock API — https://docs.docksys.xyz):
 *  1. User clicks "Verify" on the message posted by /setup-verification.
 *  2. Bot calls Dock's discord-to-roblox lookup for that user + this
 *     guild, AND creates a fresh Dock verification session (used for
 *     the Change/Link Account button URL either way).
 *       - Linked: shows a Container-based message ("You already have
 *         the Roblox account X linked...") with "Change Account"
 *         (Link-style button -> the Dock verifyUrl, handled entirely
 *         client-side, no bot code needed) and "Continue" (bot-handled).
 *       - Not linked: shows a Container telling them to link one, with
 *         just a "Link Account" Link button (same Dock verifyUrl).
 *  3. Clicking "Continue" re-queries Dock (the live source of truth —
 *     no local database); if a link now exists it grants the verified
 *     role, edits the message to the "Verification Successful"
 *     container, and logs an embed (title / description / inline
 *     field grid / "View Profile" button) to the log channel. Roblox
 *     usernames are resolved via Roblox's public users API since Dock
 *     only returns the Roblox ID.
 *
 * ENV: requires DOCK_API_KEY in your bot's environment.
 * Requires: discord.js v14.17.0+  (npm install discord.js@latest)
 * Requires: Node 18+ (global fetch)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

// ---------------------------------------------------------
// Fill these in
// ---------------------------------------------------------
const CONFIG = {
  TICKET_CHANNEL_ID: '1502793438754770976',      // #tickets
  VERIFIED_ROLE_ID: '1504325783634841600',        // role granted on verify
  LOG_CHANNEL_ID: '1532078127084343407',          // verification log channel
  BANNER_URL: 'https://yumi.onl/api/files/6a6a38b554d6927723c15003/raw',
  FOOTER_URL: 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw',
  DOT_EMOJI: '<:Dot:1502513706347528213>',

  // Dock (https://docs.docksys.xyz)
  DOCK_API_BASE: 'https://api.docksys.xyz',
  DOCK_PID: 'PID-5BbkFDWD',                        // from your Dock dashboard

  ROBLOX_ACCOUNT_EMOJI: '<:Roblox:1532200384968265828>',                      // shown next to a linked Roblox username, swap for a custom emoji if you like
  SERVER_EMOJI: '<:mode_branding_20260510_032226_00:1506790198917206156>',                              // shown next to the server name on the success screen

  // Logging (embed) look
  LOG_ACCENT_COLOR: 0x5865f2,                      // left-border accent color on the log embed
};

// customIds — how the interaction handler recognizes these clicks.
// "Change Account" / "Link Account" are Link-style buttons (a URL),
// so Discord never sends those to the bot at all — nothing to wire.
const VERIFY_BUTTON_ID = 'mode_verify';
const CONTINUE_BUTTON_ID = 'mode_verify_continue';

// ---------------------------------------------------------
// Dock API helpers
// ---------------------------------------------------------
function dockHeaders() {
  return { Authorization: `Bearer ${process.env.DOCK_API_KEY}` };
}

/** Dock's error field is usually a string, but format defensively either way. */
function formatDockError(payload) {
  if (!payload) return 'unknown error (empty response)';
  if (typeof payload.error === 'string') return payload.error;
  try {
    return JSON.stringify(payload);
  } catch {
    return 'unknown error';
  }
}

/**
 * Looks up the Roblox account linked to a Discord user in this guild.
 * Returns { robloxId, robloxUsername } or null if nothing is linked.
 * Throws on anything that isn't a clean "linked" / "not linked" result
 * (401/403/429/500), so callers can show a real error instead of
 * silently treating an outage as "not linked".
 */
async function getRobloxLink(discordId, guildId) {
  const url = `${CONFIG.DOCK_API_BASE}/api/v1/public/discord-to-roblox?discordId=${discordId}&guildId=${guildId}`;
  const res = await fetch(url, { headers: dockHeaders() });

  if (res.status === 404) return null;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Dock lookup failed (${res.status}): ${formatDockError(payload)}`);
  }

  const robloxId = payload?.data?.robloxId;
  if (!robloxId) return null;

  const robloxUsername = await getRobloxUsername(robloxId);
  return { robloxId, robloxUsername };
}

/** Dock only returns a Roblox ID, so resolve the username via Roblox's public API. */
async function getRobloxUsername(robloxId) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${robloxId}`);
    if (!res.ok) return robloxId; // fall back to showing the raw ID
    const data = await res.json();
    return data.name || robloxId;
  } catch {
    return robloxId;
  }
}

/** Creates (or reuses) a Dock verification session and returns its verifyUrl. */
async function createVerificationSession(discordId, guildId) {
  const res = await fetch(`${CONFIG.DOCK_API_BASE}/api/v1/verify/session`, {
    method: 'POST',
    headers: { ...dockHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid: CONFIG.DOCK_PID, clientId: discordId, guildId }),
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(`Dock session creation failed (${res.status}): ${formatDockError(payload)}`);
  }

  return payload?.data?.verifyUrl;
}

// ---------------------------------------------------------
// Container builders (Components V2, no accent color anywhere)
// ---------------------------------------------------------
function buildVerificationContainer() {
  const container = new ContainerBuilder(); // no .setAccentColor() -> no accent strip

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(CONFIG.BANNER_URL)
    )
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `Welcome to **.mode**! Before you continue in the server, please verify your account. ` +
      `This step is required for all members and helps keep the community safe and secure. ` +
      `Once you've verified, you'll gain full access to all channels and features.\n\n` +
      `${CONFIG.DOT_EMOJI} If you need any assistance or have any questions, please open a ticket in ` +
      `<#${CONFIG.TICKET_CHANNEL_ID}>, and a member of our team will be happy to help you.`
    )
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel('Verify')
      .setStyle(ButtonStyle.Secondary)
  );
  container.addActionRowComponents(row);

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(CONFIG.FOOTER_URL)
    )
  );

  return container;
}

/** "You already have the Roblox account X linked..." screen */
function buildAlreadyLinkedContainer(link, changeAccountUrl) {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `You **already** have the Roblox account ${CONFIG.ROBLOX_ACCOUNT_EMOJI} ` +
      `[${link.robloxUsername}](https://www.roblox.com/users/${link.robloxId}/profile) linked.\n\n` +
      `To switch to a different Roblox account, click **Change Account** below.\n\n` +
      `To continue using your current account, click **Continue**.`
    )
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Change Account')
      .setStyle(ButtonStyle.Link)
      .setURL(changeAccountUrl),
    new ButtonBuilder()
      .setCustomId(CONTINUE_BUTTON_ID)
      .setLabel('Continue')
      .setStyle(ButtonStyle.Success)
  );
  container.addActionRowComponents(row);

  return container;
}

/** Screen shown when the user has no Roblox account linked yet */
function buildNotLinkedContainer(linkAccountUrl) {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `You don't have a Roblox account linked yet.\n\n` +
      `Click **Link Account** below to link one, then click **Verify** again to finish.`
    )
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Link Account')
      .setStyle(ButtonStyle.Link)
      .setURL(linkAccountUrl)
  );
  container.addActionRowComponents(row);

  return container;
}

/** "Verification Successful — Verified as X for Y." screen */
function buildSuccessContainer(link, guildName) {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `✅ **Verification Successful**\n\n` +
      `Verified as ${CONFIG.ROBLOX_ACCOUNT_EMOJI} ` +
      `[${link.robloxUsername}](https://www.roblox.com/users/${link.robloxId}/profile) ` +
      `for ${CONFIG.SERVER_EMOJI} **${guildName}**.`
    )
  );

  return container;
}

/** Generic error screen (Dock outage, rate limit, etc) */
function buildErrorContainer(message) {
  const container = new ContainerBuilder();
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `⚠️ ${message}\n\nPlease try again in a moment, or open a ticket in <#${CONFIG.TICKET_CHANNEL_ID}> if this keeps happening.`
    )
  );
  return container;
}

// ---------------------------------------------------------
// Log embed (this one DOES use an accent color / fields,
// matching the "New Account Verification" style you want)
// ---------------------------------------------------------
function buildLogEmbed({ member, link }) {
  const embed = new EmbedBuilder()
    .setColor(CONFIG.LOG_ACCENT_COLOR)
    .setTitle('New Account Verification')
    .setDescription(`**${link.robloxUsername}** has **successfully** linked their Roblox account.`)
    .addFields(
      { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
      { name: 'Verified At', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
      { name: 'Roblox Username', value: `\`${link.robloxUsername}\``, inline: true },
      { name: 'Roblox ID', value: `\`${link.robloxId}\``, inline: true },
      { name: 'Discord User', value: `\`${member.id}\``, inline: true },
      { name: 'Discord User', value: `<@${member.id}>`, inline: true },
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('View Profile')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.roblox.com/users/${link.robloxId}/profile`)
  );

  return { embeds: [embed], components: [row] };
}

function buildFailureLogEmbed({ member, reason }) {
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Verification Failed')
    .setDescription(`Verification failed for <@${member.id}> (\`${member.id}\`).`)
    .addFields({ name: 'Reason', value: reason || 'Unknown error' });

  return { embeds: [embed] };
}

// ---------------------------------------------------------
// Button handlers — call these from your single, existing
// InteractionCreate handler (see wiring notes at the bottom)
// ---------------------------------------------------------
async function handleVerifyButton(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const [link, verifyUrl] = await Promise.all([
      getRobloxLink(interaction.user.id, interaction.guildId),
      createVerificationSession(interaction.user.id, interaction.guildId),
    ]);

    if (link) {
      await interaction.editReply({
        components: [buildAlreadyLinkedContainer(link, verifyUrl)],
        flags: MessageFlags.IsComponentsV2,
      });
    } else {
      await interaction.editReply({
        components: [buildNotLinkedContainer(verifyUrl)],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  } catch (err) {
    console.error('Dock lookup/session error:', err);
    await interaction.editReply({
      components: [buildErrorContainer('Something went wrong checking your Roblox verification.')],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

async function handleContinueButton(interaction) {
  // Acknowledge fast, then edit — avoids the "didn't respond in time" error.
  await interaction.deferUpdate();

  const member = interaction.member;

  try {
    const link = await getRobloxLink(interaction.user.id, interaction.guildId);

    if (!link) {
      const linkAccountUrl = await createVerificationSession(interaction.user.id, interaction.guildId);
      await interaction.editReply({
        components: [buildNotLinkedContainer(linkAccountUrl)],
        flags: MessageFlags.IsComponentsV2,
      });
      return;
    }

    if (!member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
      await member.roles.add(CONFIG.VERIFIED_ROLE_ID);
    }

    await interaction.editReply({
      components: [buildSuccessContainer(link, interaction.guild.name)],
      flags: MessageFlags.IsComponentsV2,
    });

    const logChannel = await interaction.client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
    await logChannel.send(buildLogEmbed({ member, link }));
  } catch (err) {
    console.error('Verification error:', err);

    await interaction.editReply({
      components: [buildErrorContainer('Something went wrong while verifying you.')],
      flags: MessageFlags.IsComponentsV2,
    });

    try {
      const logChannel = await interaction.client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
      await logChannel.send(buildFailureLogEmbed({ member, reason: err.message }));
    } catch (logErr) {
      console.error('Failed to send log message:', logErr);
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verification')
    .setDescription('Post the .mode verification message in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const container = buildVerificationContainer();
    await interaction.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    await interaction.reply({
      content: 'Verification message posted.',
      flags: MessageFlags.Ephemeral,
    });
  },

  // exported so your main file can route button clicks to it
  VERIFY_BUTTON_ID,
  CONTINUE_BUTTON_ID,
  handleVerifyButton,
  handleContinueButton,

  // exported in case you want to call Dock directly elsewhere
  getRobloxLink,
  createVerificationSession,
};

/**
 * -------------------------------------------------------
 * WIRING INTO YOUR EXISTING BOT
 * -------------------------------------------------------
 * 1. Drop this file in commands/ as verification.js (already done).
 *    Your existing command loader should pick up `data` and `execute`
 *    the same way it does for ban.js, kick.js, etc.
 *
 * 2. Find your ONE existing
 *      client.on(Events.InteractionCreate, async (interaction) => { ... })
 *    Inside it, alongside your existing slash-command dispatch, add:
 *
 *      const verification = require('./commands/verification.js');
 *
 *      if (interaction.isButton() && interaction.customId === verification.VERIFY_BUTTON_ID) {
 *        await verification.handleVerifyButton(interaction);
 *        return;
 *      }
 *      if (interaction.isButton() && interaction.customId === verification.CONTINUE_BUTTON_ID) {
 *        await verification.handleContinueButton(interaction);
 *        return;
 *      }
 *
 *    Note: "Change Account" / "Link Account" are Link-style buttons
 *    (a real Dock verifyUrl, freshly generated per click), so Discord
 *    opens them client-side and never sends an interaction to your
 *    bot — nothing to wire for those.
 *
 * 3. Set these in your bot's environment / config:
 *      - DOCK_API_KEY  (env var — used exactly like your original snippet)
 *      - CONFIG.DOCK_PID in this file — the PID your Dock API key owns
 *        (find it in your Dock dashboard where you created the API key)
 *
 * 4. Set CONFIG.LOG_ACCENT_COLOR / emojis to taste.
 *
 * 5. Restart the bot once. Nothing here calls rest.put, so your other
 *    slash commands won't disappear.
 */