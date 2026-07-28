'use strict';

const { EmbedBuilder } = require('discord.js');
const config = require('../ticketConfig.json');

function baseEmbed() {
  return new EmbedBuilder()
    .setColor(config.branding.colors.primary)
    .setFooter({ text: config.branding.footer, iconURL: config.branding.iconUrl })
    .setTimestamp();
}

function panelEmbed() {
  const lines = Object.entries(config.categories)
    .map(([, cat]) => `${cat.emoji}  **${cat.label}**\n> ${cat.description}`)
    .join('\n\n');

  return baseEmbed()
    .setColor(config.branding.colors.primary)
    .setAuthor({ name: config.branding.name, iconURL: config.branding.iconUrl })
    .setTitle('🎫  Support Center')
    .setDescription(
      `Welcome to the **${config.branding.name}** ticket system.\n` +
      `Select a category below that best matches your request — our team will assist you shortly.\n\n` +
      `${lines}`
    )
    .setThumbnail(config.branding.iconUrl);
}

function ticketWelcomeEmbed(ticket, category, opener) {
  const p = config.priorities[ticket.priority];
  return baseEmbed()
    .setColor(category.color)
    .setAuthor({ name: `${category.emoji} ${category.label}`, iconURL: config.branding.iconUrl })
    .setTitle(`Ticket #${ticket.ticket_number}`)
    .setDescription(
      `Hello ${opener}, thanks for contacting **${config.branding.name}**.\n` +
      `A member of our **${category.label}** team will be with you shortly.\n\n` +
      `Use the buttons below to manage this ticket.`
    )
    .addFields(
      { name: 'Category', value: `${category.emoji} ${category.label}`, inline: true },
      { name: 'Priority', value: `${p.emoji} ${p.label}`, inline: true },
      { name: 'Opened by', value: `${opener}`, inline: true }
    );
}

function formSummaryEmbed(category, formData) {
  const embed = baseEmbed()
    .setColor(category.color)
    .setTitle('📋 Submitted Information');

  for (const field of category.form.fields) {
    const value = formData[field.id];
    if (value) {
      embed.addFields({ name: field.label, value: value.length > 1024 ? value.slice(0, 1021) + '...' : value });
    }
  }
  return embed;
}

function statusEmbed({ title, description, color = 'primary' }) {
  return baseEmbed()
    .setColor(config.branding.colors[color] || color)
    .setTitle(title)
    .setDescription(description);
}

function ticketInfoEmbed(ticket, category) {
  const p = config.priorities[ticket.priority];
  const claimed = ticket.claimed_by ? `<@${ticket.claimed_by}>` : '*Unclaimed*';
  const addedUsers = JSON.parse(ticket.added_users || '[]');

  return baseEmbed()
    .setColor(category.color)
    .setTitle(`🎫 Ticket #${ticket.ticket_number} — Info`)
    .addFields(
      { name: 'Status', value: `\`${ticket.status}\``, inline: true },
      { name: 'Priority', value: `${p.emoji} ${p.label}`, inline: true },
      { name: 'Claimed by', value: claimed, inline: true },
      { name: 'Opened by', value: `<@${ticket.opener_id}>`, inline: true },
      { name: 'Created', value: `<t:${Math.floor(ticket.created_at / 1000)}:R>`, inline: true },
      { name: 'Added users', value: addedUsers.length ? addedUsers.map(id => `<@${id}>`).join(', ') : 'None', inline: true }
    );
}

function ratingEmbed(ticket, category, rating, comment, ratedBy) {
  const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
  return baseEmbed()
    .setColor(config.branding.colors.premium)
    .setTitle(`⭐ New Rating — Ticket #${ticket.ticket_number}`)
    .addFields(
      { name: 'Category', value: `${category.emoji} ${category.label}`, inline: true },
      { name: 'Rating', value: stars, inline: true },
      { name: 'Rated by', value: `<@${ratedBy}>`, inline: true },
      { name: 'Comment', value: comment || '*No comment left*' }
    );
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return 'N/A';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function analyticsEmbed(analytics, periodLabel, leaderboard) {
  const categoryLines = Object.entries(analytics.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => {
      const cat = config.categories[key];
      return `${cat ? cat.emoji : '❓'} ${cat ? cat.label : key}: **${count}**`;
    })
    .join('\n') || '*No data yet*';

  const peakHour = analytics.hourBuckets.indexOf(Math.max(...analytics.hourBuckets));
  const peakLabel = analytics.hourBuckets.some(v => v > 0)
    ? `${peakHour}:00 – ${(peakHour + 1) % 24}:00 UTC`
    : 'N/A';

  const leaderboardLines = (leaderboard || []).slice(0, 5).map((s, i) => {
    const avgRating = s.rating_count ? (s.rating_sum / s.rating_count).toFixed(1) : 'N/A';
    return `**${i + 1}.** <@${s.staff_id}> — 🎫 ${s.tickets_closed} closed | ⭐ ${avgRating}`;
  }).join('\n') || '*No staff activity yet*';

  return baseEmbed()
    .setColor(config.branding.colors.premium)
    .setAuthor({ name: `${config.branding.name} — Analytics Dashboard`, iconURL: config.branding.iconUrl })
    .setTitle(`📊 Ticket Analytics — ${periodLabel}`)
    .addFields(
      { name: 'Total Tickets', value: `${analytics.total}`, inline: true },
      { name: 'Open', value: `${analytics.open}`, inline: true },
      { name: 'Closed', value: `${analytics.closed}`, inline: true },
      { name: 'Avg. First Response', value: formatDuration(analytics.avgResponseMs), inline: true },
      { name: 'Avg. Resolution Time', value: formatDuration(analytics.avgResolveMs), inline: true },
      { name: 'Avg. Satisfaction', value: analytics.avgRating ? `⭐ ${analytics.avgRating.toFixed(2)} / 5 (${analytics.ratedCount} ratings)` : 'N/A', inline: true },
      { name: 'Peak Activity Hour', value: peakLabel, inline: true },
      { name: '📂 Category Distribution', value: categoryLines },
      { name: '🏆 Staff Leaderboard', value: leaderboardLines }
    );
}

module.exports = {
  baseEmbed,
  panelEmbed,
  ticketWelcomeEmbed,
  formSummaryEmbed,
  statusEmbed,
  ticketInfoEmbed,
  ratingEmbed,
  analyticsEmbed
};