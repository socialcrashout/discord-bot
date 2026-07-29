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
 * Uses Discord Components V2 (Container / MediaGallery / TextDisplay)
 * for the message — banner, body text, footer, all in one bordered
 * container with no accent color strip.
 *
 * Requires: discord.js v14.17.0+  (npm install discord.js@latest)
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
} = require('discord.js');

// ---------------------------------------------------------
// Fill these in
// ---------------------------------------------------------
const CONFIG = {
  TICKET_CHANNEL_ID: '1502793438754770976',      // #tickets
  VERIFIED_ROLE_ID: '1504325783634841600',     // role granted on verify
  LOG_CHANNEL_ID: 'YOUR_LOG_CHANNEL_ID',         // verification log channel
  BANNER_URL: 'https://yumi.onl/api/files/6a6a38b554d6927723c15003/raw',
  FOOTER_URL: 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw',
  DOT_EMOJI: '<:Dot:1502513706347528213>',
};

// This customId is how your main interaction handler will recognize
// the button click below — see wiring instructions at the bottom.
const VERIFY_BUTTON_ID = 'mode_verify';

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
      .setEmoji('✅')
  );
  container.addActionRowComponents(row);

  return container;
}

function buildLogContainer({ member, success, reason }) {
  const container = new ContainerBuilder();
  const status = success ? '✅ Verification Successful' : '⚠️ Verification Failed';
  const lines = [
    `**${status}**`,
    `User: <@${member.id}> (\`${member.user.tag}\` / \`${member.id}\`)`,
    `Time: <t:${Math.floor(Date.now() / 1000)}:F>`,
  ];
  if (reason) lines.push(`Reason: ${reason}`);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
  return container;
}

// ---------------------------------------------------------
// Handles the Verify button click. Call this from your main
// InteractionCreate handler (see wiring notes below) — do NOT
// add a second client.on(Events.InteractionCreate) anywhere.
// ---------------------------------------------------------
async function handleVerifyButton(interaction) {
  const member = interaction.member;

  try {
    if (member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
      await interaction.reply({
        content: 'You are already verified.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await member.roles.add(CONFIG.VERIFIED_ROLE_ID);

    await interaction.reply({
      content: '✅ You have been verified! You now have full access to the server.',
      flags: MessageFlags.Ephemeral,
    });

    const logChannel = await interaction.client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
    await logChannel.send({
      components: [buildLogContainer({ member, success: true })],
      flags: MessageFlags.IsComponentsV2,
    });
  } catch (err) {
    console.error('Verification error:', err);

    await interaction.reply({
      content: 'Something went wrong while verifying you. Please open a ticket for help.',
      flags: MessageFlags.Ephemeral,
    });

    try {
      const logChannel = await interaction.client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
      await logChannel.send({
        components: [buildLogContainer({ member, success: false, reason: err.message })],
        flags: MessageFlags.IsComponentsV2,
      });
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

  // exported so your main file can route the button click to it
  VERIFY_BUTTON_ID,
  handleVerifyButton,
};

/**
 * -------------------------------------------------------
 * WIRING INTO YOUR EXISTING BOT
 * -------------------------------------------------------
 * 1. Drop this file in commands/ as verification.js (already done).
 *    Your existing command loader should pick up `data` and `execute`
 *    the same way it does for ban.js, kick.js, etc. — nothing extra
 *    to register by hand, and nothing here will touch your other
 *    commands.
 *
 * 2. Find wherever your bot already has ONE
 *      client.on(Events.InteractionCreate, async (interaction) => { ... })
 *    (there should only be this one, in your main file). Inside it,
 *    alongside the existing slash-command dispatch, add a branch
 *    for buttons:
 *
 *      const verification = require('./commands/verification.js');
 *
 *      if (interaction.isButton() && interaction.customId === verification.VERIFY_BUTTON_ID) {
 *        await verification.handleVerifyButton(interaction);
 *        return;
 *      }
 *
 * 3. Restart the bot once. Since nothing here calls rest.put anymore,
 *    your other commands won't disappear again.
 *
 * If your other slash commands are still missing right now, re-run
 * whatever script/command your project normally uses to bulk-register
 * all commands in commands/ — that will restore the full list.
 */