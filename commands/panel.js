'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embeds = require('../utils/ticketEmbeds');
const components = require('../utils/ticketComponents');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post the support ticket panel in a channel')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to post the panel in (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    await channel.send({
      embeds: [embeds.panelEmbed()],
      components: [components.categorySelectMenu()]
    });

    await interaction.reply({ content: `✅ Ticket panel posted in ${channel}.`, ephemeral: true });
  }
};