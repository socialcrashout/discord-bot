'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../utils/ticketDb');
const embeds = require('../utils/ticketEmbeds');
const perms = require('../utils/ticketPermissions');

const PERIODS = {
  today: { label: 'Today', ms: 24 * 60 * 60 * 1000 },
  week: { label: 'Last 7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  month: { label: 'Last 30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  all: { label: 'All Time', ms: null }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketstats')
    .setDescription('View the ticket analytics dashboard')
    .addStringOption(opt =>
      opt.setName('period')
        .setDescription('Time period to analyze')
        .addChoices(
          { name: 'Today', value: 'today' },
          { name: 'Last 7 Days', value: 'week' },
          { name: 'Last 30 Days', value: 'month' },
          { name: 'All Time', value: 'all' }
        )
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!perms.isStaff(interaction.member)) {
      return interaction.reply({ content: 'You do not have permission to view ticket analytics.', ephemeral: true });
    }

    const periodKey = interaction.options.getString('period') || 'week';
    const period = PERIODS[periodKey];
    const since = period.ms ? Date.now() - period.ms : 0;

    const analytics = db.getAnalytics(interaction.guild.id, since);
    const leaderboard = db.getStaffLeaderboard(10);

    await interaction.reply({ embeds: [embeds.analyticsEmbed(analytics, period.label, leaderboard)] });
  }
};