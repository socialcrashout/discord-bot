'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/ticketDb');
const embeds = require('../utils/ticketEmbeds');
const perms = require('../utils/ticketPermissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketblacklist')
    .setDescription('Manage which users are blocked from creating tickets')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Blacklist a user from opening tickets')
        .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason for the blacklist').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the ticket blacklist')
        .addUserOption(o => o.setName('user').setDescription('User to unblacklist').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!perms.canPerformAction(interaction.member, 'blacklist_user')) {
      return interaction.reply({ content: 'You do not have permission to manage the blacklist.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (sub === 'add') {
      const reason = interaction.options.getString('reason') || 'No reason provided';
      db.addBlacklist(user.id, reason, interaction.user.id);
      return interaction.reply({
        embeds: [embeds.statusEmbed({ title: '🚫 User Blacklisted', description: `${user} can no longer create tickets.\n**Reason:** ${reason}`, color: 'danger' })]
      });
    }

    if (sub === 'remove') {
      db.removeBlacklist(user.id);
      return interaction.reply({
        embeds: [embeds.statusEmbed({ title: '✅ User Removed from Blacklist', description: `${user} can now create tickets again.`, color: 'success' })]
      });
    }
  }
};