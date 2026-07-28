'use strict';

const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, UserSelectMenuBuilder
} = require('discord.js');
const config = require('../ticketConfig.json');

function categorySelectMenu() {
  const options = Object.entries(config.categories).map(([key, cat]) => ({
    label: cat.label,
    description: cat.description.slice(0, 100),
    value: key,
    emoji: cat.emoji
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:select_category')
    .setPlaceholder('📂 Select a support category...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

function ticketControlRow(ticket) {
  const isLocked = ticket.status === 'locked';
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:claim')
      .setLabel(ticket.claimed_by ? 'Claimed' : 'Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!!ticket.claimed_by),
    new ButtonBuilder()
      .setCustomId('ticket:priority')
      .setLabel('Priority')
      .setEmoji('🚩')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(isLocked ? 'ticket:unlock' : 'ticket:lock')
      .setLabel(isLocked ? 'Unlock' : 'Lock')
      .setEmoji(isLocked ? '🔓' : '🔒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:transfer')
      .setLabel('Transfer')
      .setEmoji('🔁')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:add_user')
      .setLabel('Add User')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:remove_user')
      .setLabel('Remove User')
      .setEmoji('➖')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:rename')
      .setLabel('Rename')
      .setEmoji('✏️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:note')
      .setLabel('Staff Note')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:info')
      .setLabel('Info')
      .setEmoji('ℹ️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:escalate')
      .setLabel('Escalate')
      .setEmoji('⬆️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

function closeConfirmRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close_confirm').setLabel('Confirm Close').setEmoji('✅').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:close_cancel').setLabel('Cancel').setEmoji('✖️').setStyle(ButtonStyle.Secondary)
  );
}

function reopenDeleteRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:reopen').setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket:transcript').setLabel('View Transcript').setEmoji('📄').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:delete').setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
}

function priorityMenuRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:set_priority')
    .setPlaceholder('🚩 Select new priority...')
    .addOptions(
      Object.entries(config.priorities).map(([key, p]) => ({
        label: p.label, value: key, emoji: p.emoji
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function ratingRow() {
  const row = new ActionRowBuilder();
  for (let i = 1; i <= 5; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:rate_${i}`)
        .setLabel(`${i}`)
        .setEmoji('⭐')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return row;
}

function userSelectRow(customId, placeholder) {
  const menu = new UserSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);
  return new ActionRowBuilder().addComponents(menu);
}

function transferCategorySelectMenu(currentCategoryKey) {
  const options = Object.entries(config.categories)
    .filter(([key]) => key !== currentCategoryKey)
    .map(([key, cat]) => ({ label: cat.label, value: key, emoji: cat.emoji, description: cat.description.slice(0, 100) }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('ticket:transfer_target')
    .setPlaceholder('🔁 Transfer to which department?')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

module.exports = {
  categorySelectMenu,
  ticketControlRow,
  closeConfirmRow,
  reopenDeleteRow,
  priorityMenuRow,
  ratingRow,
  userSelectRow,
  transferCategorySelectMenu
};