'use strict';

const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../ticketConfig.json');

const STYLE_MAP = { short: TextInputStyle.Short, paragraph: TextInputStyle.Paragraph };

/** Discord modals support a maximum of 5 fields — validated defensively here. */
function buildCategoryModal(categoryKey) {
  const category = config.categories[categoryKey];
  if (!category) throw new Error(`Unknown category: ${categoryKey}`);
  if (category.form.fields.length > 5) {
    throw new Error(`Category "${categoryKey}" has more than 5 form fields; Discord modals cap at 5.`);
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket:modal:${categoryKey}`)
    .setTitle(category.form.title.slice(0, 45));

  for (const field of category.form.fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label.slice(0, 45))
      .setStyle(STYLE_MAP[field.style] || TextInputStyle.Short)
      .setRequired(!!field.required);

    if (field.placeholder) input.setPlaceholder(field.placeholder.slice(0, 100));
    if (field.minLength) input.setMinLength(field.minLength);
    if (field.maxLength) input.setMaxLength(Math.min(field.maxLength, 4000));

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

/** Extract field values from a submitted modal interaction into a plain object keyed by field id. */
function parseModalSubmission(interaction, categoryKey) {
  const category = config.categories[categoryKey];
  const data = {};
  for (const field of category.form.fields) {
    data[field.id] = interaction.fields.getTextInputValue(field.id)?.trim() || '';
  }
  return data;
}

/**
 * Lightweight extra validation beyond Discord's own min/max length enforcement —
 * e.g. conditional / semantic checks that TextInput can't express natively.
 * Returns an array of human-readable error strings (empty = valid).
 */
function validateFormData(categoryKey, data) {
  const errors = [];

  if (categoryKey === 'executive_support') {
    if ((data.acknowledgement || '').toUpperCase() !== 'CONFIRM') {
      errors.push('You must type `CONFIRM` in the acknowledgement field to open an Executive ticket.');
    }
  }

  if (categoryKey === 'general_support') {
    const urgency = (data.urgency || '').toLowerCase();
    if (!['low', 'medium', 'high'].includes(urgency)) {
      errors.push('Urgency must be one of: Low, Medium, High.');
    }
  }

  if (categoryKey === 'public_relations') {
    const email = data.contact || '';
    const looksLikeEmailOrHandle = /[@].+[.]|discord|@/.test(email);
    if (!looksLikeEmailOrHandle) {
      errors.push('Please provide a valid email address or contact handle.');
    }
  }

  return errors;
}

/** Derive an initial ticket priority: honor an explicit "urgency" field if present, else category default. */
function derivePriority(categoryKey, data) {
  const category = config.categories[categoryKey];
  const urgency = (data.urgency || '').toLowerCase();
  const map = { low: 'low', medium: 'medium', high: 'high', urgent: 'urgent' };
  if (map[urgency]) return map[urgency];
  return category.priorityDefault || 'medium';
}

function buildRenameModal(currentName) {
  const modal = new ModalBuilder().setCustomId('ticket:modal:rename').setTitle('Rename Ticket');
  const input = new TextInputBuilder()
    .setCustomId('new_name')
    .setLabel('New channel name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. billing-jane-refund')
    .setValue(currentName || '')
    .setRequired(true)
    .setMaxLength(90);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildNoteModal() {
  const modal = new ModalBuilder().setCustomId('ticket:modal:note').setTitle('Add Internal Staff Note');
  const input = new TextInputBuilder()
    .setCustomId('note_content')
    .setLabel('Note (only visible to staff)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Internal context, decisions made, follow-ups needed...')
    .setRequired(true)
    .setMaxLength(1000);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildCloseReasonModal() {
  const modal = new ModalBuilder().setCustomId('ticket:modal:close_reason').setTitle('Close Ticket');
  const input = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel('Reason for closing (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g. Resolved — refund processed')
    .setRequired(false)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function buildRatingCommentModal(rating) {
  const modal = new ModalBuilder().setCustomId(`ticket:modal:rating_comment_${rating}`).setTitle(`Rate this ticket: ${rating}/5`);
  const input = new TextInputBuilder()
    .setCustomId('rating_comment')
    .setLabel('Any additional feedback? (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

module.exports = {
  buildCategoryModal,
  parseModalSubmission,
  validateFormData,
  derivePriority,
  buildRenameModal,
  buildNoteModal,
  buildCloseReasonModal,
  buildRatingCommentModal
};