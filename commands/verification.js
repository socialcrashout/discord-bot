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
 * FLOW:
 *  1. User clicks "Verify" on the message posted by /setup-verification.
 *  2. Bot looks up the user's linked Roblox account in a local JSON
 *     store (data/roblox-links.json).
 *       - If linked: shows a Container-based message ("You already
 *         have the Roblox account X linked...") with two buttons:
 *         "Change Account" (Link-style button -> your dock.xyz URL,
 *         handled entirely by Discord client-side, no bot code
 *         needed) and "Continue" (bot-handled button).
 *       - If NOT linked: shows a Container-based message telling
 *         them to link one, with just a "Link Account" Link button.
 *  3. Clicking "Continue" re-checks the store; if a link exists it
 *     grants the verified role, edits the message to the
 *     "Verification Successful" container, and logs an embed
 *     (title / description / inline field grid / banner image /
 *     "View Profile" button) to the log channel.
 *
 * NOTE ON DATA: data/roblox-links.json is a simple flat file for now.
 * You (or whatever links Roblox accounts) are responsible for writing
 * entries into it — see setRobloxLink() below for the shape. Swap
 * readStore/writeStore for real DB calls later without touching the
 * rest of the file.
 *
 * Requires: discord.js v14.17.0+  (npm install discord.js@latest)
 */

const fs = require('node:fs');
const path = require('node:path');
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

  // New Roblox-link flow
  CHANGE_ACCOUNT_URL: 'https://dock.xyz/verify',   // where "Change Account" / "Link Account" sends users
  ROBLOX_ACCOUNT_EMOJI: '🐧',                      // shown next to a linked Roblox username, swap for a custom emoji if you like
  SERVER_EMOJI: '🏔️',                              // shown next to the server name on the success screen

  // Logging (embed) look
  LOG_ACCENT_COLOR: 0x5865f2,                      // left-border accent color on the log embed
  LOG_BANNER_URL: 'https://yumi.onl/api/files/6a6a38b554d6927723c15003/raw', // gradient banner at the bottom of the log embed

  // JSON store of discordId -> { robloxUsername, robloxId, verifiedAt }
  ROBLOX_LINKS_FILE: path.join(__dirname, '..', 'data', 'roblox-links.json'),
};

// customIds — how the interaction handler recognizes these clicks.
// "Change Account" / "Link Account" are Link-style buttons (a URL),
// so Discord never sends those to the bot at all — nothing to wire.
const VERIFY_BUTTON_ID = 'mode_verify';
const CONTINUE_BUTTON_ID = 'mode_verify_continue';

// ---------------------------------------------------------
// Tiny JSON store helpers — swap these for real DB calls later
// ---------------------------------------------------------
function ensureStore() {
  const dir = path.dirname(CONFIG.ROBLOX_LINKS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CONFIG.ROBLOX_LINKS_FILE)) {
    fs.writeFileSync(CONFIG.ROBLOX_LINKS_FILE, JSON.stringify({}, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(CONFIG.ROBLOX_LINKS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeStore(data) {
  ensureStore();
  fs.writeFileSync(CONFIG.ROBLOX_LINKS_FILE, JSON.stringify(data, null, 2));
}

/** Returns { robloxUsername, robloxId, verifiedAt } or null */
function getRobloxLink(discordId) {
  const store = readStore();
  return store[discordId] || null;
}

/** Call this from wherever your Roblox-linking flow finishes. */
function setRobloxLink(discordId, { robloxUsername, robloxId }) {
  const store = readStore();
  store[discordId] = {
    robloxUsername,
    robloxId,
    verifiedAt: store[discordId]?.verifiedAt ?? null, // set on Continue, not on link
  };
  writeStore(store);
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

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(CONFIG.FOOTER_URL)
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel('Verify')
      .setStyle(ButtonStyle.Secondary)
  );
  container.addActionRowComponents(row);

  return container;
}

/** "You already have the Roblox account X linked..." screen */
function buildAlreadyLinkedContainer(link) {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `You **already** have the Roblox account ${CONFIG.ROBLOX_ACCOUNT_EMOJI} ` +
      `[${link.robloxUsername}](https://www.roblox.com/users/${link.robloxId}/profile) linked.\n\n` +
      `To switch to a different Roblox account, click **Change Account** below.\n\n` +
      `To continue using your current account, click **Continue**.`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Change Account')
      .setStyle(ButtonStyle.Link)
      .setURL(CONFIG.CHANGE_ACCOUNT_URL),
    new ButtonBuilder()
      .setCustomId(CONTINUE_BUTTON_ID)
      .setLabel('Continue')
      .setStyle(ButtonStyle.Success)
  );
  container.addActionRowComponents(row);

  return container;
}

/** Screen shown when the user has no Roblox account linked yet */
function buildNotLinkedContainer() {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `You don't have a Roblox account linked yet.\n\n` +
      `Click **Link Account** below to link one, then click **Verify** again to finish.`
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Link Account')
      .setStyle(ButtonStyle.Link)
      .setURL(CONFIG.CHANGE_ACCOUNT_URL)
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

// ---------------------------------------------------------
// Log embed (this one DOES use an accent color / fields / image,
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
    )
    .setImage(CONFIG.LOG_BANNER_URL);

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
  const link = getRobloxLink(interaction.user.id);

  if (link) {
    await interaction.reply({
      components: [buildAlreadyLinkedContainer(link)],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      components: [buildNotLinkedContainer()],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }
}

async function handleContinueButton(interaction) {
  // Acknowledge fast, then edit — avoids the "didn't respond in time" error.
  await interaction.deferUpdate();

  const member = interaction.member;
  const link = getRobloxLink(interaction.user.id);

  if (!link) {
    await interaction.editReply({
      components: [buildNotLinkedContainer()],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  try {
    // stamp verifiedAt now and persist
    const store = readStore();
    store[interaction.user.id] = { ...link, verifiedAt: Date.now() };
    writeStore(store);

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
      content: 'Something went wrong while verifying you. Please open a ticket for help.',
      components: [],
      flags: MessageFlags.Ephemeral,
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

  // exported so whatever finishes your Roblox-linking flow can write
  // to the store (call setRobloxLink(discordId, { robloxUsername, robloxId }))
  getRobloxLink,
  setRobloxLink,
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
 *    (a raw URL), so Discord opens them client-side and never sends
 *    an interaction to your bot — nothing to wire for those.
 *
 * 3. Fill in data/roblox-links.json manually for now, shaped like:
 *      {
 *        "144256906984790858": {
 *          "robloxUsername": "Jek12345003",
 *          "robloxId": "7186967351",
 *          "verifiedAt": null
 *        }
 *      }
 *    Or call verification.setRobloxLink(discordId, { robloxUsername, robloxId })
 *    from wherever your real linking flow lands, once you build it.
 *
 * 4. Set CONFIG.CHANGE_ACCOUNT_URL to your real dock.xyz link, and
 *    CONFIG.LOG_BANNER_URL / CONFIG.LOG_ACCENT_COLOR / emojis to taste.
 *
 * 5. Restart the bot once. Nothing here calls rest.put, so your other
 *    slash commands won't disappear.
 */