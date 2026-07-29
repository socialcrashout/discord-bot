/**
 * .mode Verification System
 * -------------------------------------------------------
 * Uses Discord Components V2 (Container / MediaGallery / TextDisplay)
 * to render the verification message exactly like your reference
 * screenshots — banner, body text, footer, all in one bordered
 * container with NO accent color strip.
 *
 * Requires: discord.js v14.17.0 or newer (Components V2 support)
 *   npm install discord.js@latest
 *
 * -------------------------------------------------------
 * SETUP — fill these in before running
 * -------------------------------------------------------
 * Token is read from .env (needs a line like: TOKEN=your_bot_token_here)
 *   npm install dotenv
 */
require('dotenv').config();

const CONFIG = {
  TOKEN: process.env.DISCORD_TOKEN,                      // bot token, loaded from .env
  GUILD_ID: '1502510812441608222',               // .mode server id (from your ticket link)
  TICKET_CHANNEL_ID: '1502793438754770976',      // #tickets, used in the body text
  VERIFIED_ROLE_ID: '1504325783634841600',     // role granted on verify
  LOG_CHANNEL_ID: 'YOUR_LOG_CHANNEL_ID',         // where verification logs are posted
  BANNER_URL: 'https://yumi.onl/api/files/6a6a38b554d6927723c15003/raw',
  FOOTER_URL: 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw',
  DOT_EMOJI: '<:Dot:1502513706347528213>',
};

const {
  Client,
  GatewayIntentBits,
  Events,
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
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ---------------------------------------------------------
// Build the main verification message (Components V2)
// ---------------------------------------------------------
function buildVerificationContainer() {
  const container = new ContainerBuilder(); // no .setAccentColor() -> no accent strip

  // Banner image
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(CONFIG.BANNER_URL)
    )
  );

  // Body text
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

  // Footer image
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(CONFIG.FOOTER_URL)
    )
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Verify button
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mode_verify')
      .setLabel('Verify')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✅')
  );
  container.addActionRowComponents(row);

  return container;
}

// ---------------------------------------------------------
// Build a small log container (posted to LOG_CHANNEL_ID)
// ---------------------------------------------------------
function buildLogContainer({ member, success, reason }) {
  const container = new ContainerBuilder();

  const status = success ? '✅ Verification Successful' : '⚠️ Verification Failed';
  const lines = [
    `**${status}**`,
    `User: <@${member.id}> (\`${member.user.tag}\` / \`${member.id}\`)`,
    `Time: <t:${Math.floor(Date.now() / 1000)}:F>`,
  ];
  if (reason) lines.push(`Reason: ${reason}`);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lines.join('\n'))
  );

  return container;
}

// ---------------------------------------------------------
// Slash command: /setup-verification
// Posts the verification message in the current channel.
// ---------------------------------------------------------
const setupCommand = new SlashCommandBuilder()
  .setName('setup-verification')
  .setDescription('Post the .mode verification message in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  await rest.put(
    Routes.applicationGuildCommands(client.user.id, CONFIG.GUILD_ID),
    { body: [setupCommand.toJSON()] }
  );
  console.log('Slash commands registered.');
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  // --- Slash command handler ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-verification') {
    const container = buildVerificationContainer();
    await interaction.channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
    await interaction.reply({ content: 'Verification message posted.', ephemeral: true });
    return;
  }

  // --- Verify button handler ---
  if (interaction.isButton() && interaction.customId === 'mode_verify') {
    const member = interaction.member;

    try {
      if (member.roles.cache.has(CONFIG.VERIFIED_ROLE_ID)) {
        await interaction.reply({
          content: 'You are already verified.',
          ephemeral: true,
        });
        return;
      }

      await member.roles.add(CONFIG.VERIFIED_ROLE_ID);

      await interaction.reply({
        content: '✅ You have been verified! You now have full access to the server.',
        ephemeral: true,
      });

      // Log success
      const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
      await logChannel.send({
        components: [buildLogContainer({ member, success: true })],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      console.error('Verification error:', err);

      await interaction.reply({
        content: 'Something went wrong while verifying you. Please open a ticket for help.',
        ephemeral: true,
      });

      try {
        const logChannel = await client.channels.fetch(CONFIG.LOG_CHANNEL_ID);
        await logChannel.send({
          components: [
            buildLogContainer({ member, success: false, reason: err.message }),
          ],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (logErr) {
        console.error('Failed to send log message:', logErr);
      }
    }
  }
});

client.login(CONFIG.TOKEN);