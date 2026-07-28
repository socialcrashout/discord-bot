'use strict';

const config = require('../ticketConfig.json');
const db = require('../utils/ticketDb');
const perms = require('../utils/ticketPermissions');
const embeds = require('../utils/ticketEmbeds');
const components = require('../utils/ticketComponents');
const forms = require('../utils/ticketForms');
const lifecycle = require('../utils/ticketLifecycle');
const { generateTranscript } = require('../utils/transcript');

const CREATE_COOLDOWN_ACTION = 'create_ticket';

async function safeReply(interaction, payload) {
  const opts = { ...payload, ephemeral: true };
  if (interaction.replied || interaction.deferred) return interaction.followUp(opts);
  return interaction.reply(opts);
}

function getTicketOrWarn(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) {
    safeReply(interaction, { embeds: [embeds.statusEmbed({ title: 'Not a Ticket', description: 'This command can only be used inside a ticket channel.', color: 'danger' })] });
    return null;
  }
  return ticket;
}

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:select_category') {
        return handleCategorySelect(interaction);
      }
      if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket:modal:')) {
        return handleModalSubmit(interaction);
      }
      if (interaction.isButton() && interaction.customId.startsWith('ticket:')) {
        return handleButton(interaction);
      }
      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:set_priority') {
        return handleSetPriority(interaction);
      }
      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket:transfer_target') {
        return handleTransferTarget(interaction);
      }
      if (interaction.isUserSelectMenu && interaction.isUserSelectMenu() && interaction.customId === 'ticket:add_user_select') {
        return handleAddUserSelect(interaction);
      }
      if (interaction.isUserSelectMenu && interaction.isUserSelectMenu() && interaction.customId === 'ticket:remove_user_select') {
        return handleRemoveUserSelect(interaction);
      }
    } catch (err) {
      console.error('[ticket interactionCreate] error:', err);
      await safeReply(interaction, {
        embeds: [embeds.statusEmbed({ title: 'Something Went Wrong', description: `\`${err.message}\``, color: 'danger' })]
      }).catch(() => {});
    }
  }
};

// ---------------------------------------------------------------------------
// Category selection -> blacklist/cooldown/limit checks -> open modal
// ---------------------------------------------------------------------------
async function handleCategorySelect(interaction) {
  const categoryKey = interaction.values[0];
  const category = config.categories[categoryKey];
  const userId = interaction.user.id;

  if (db.isBlacklisted(userId)) {
    return safeReply(interaction, { embeds: [embeds.statusEmbed({ title: 'Access Denied', description: 'You are blacklisted from creating support tickets.', color: 'danger' })] });
  }

  const cooldownExpires = db.getCooldown(userId, CREATE_COOLDOWN_ACTION);
  if (cooldownExpires) {
    return safeReply(interaction, { embeds: [embeds.statusEmbed({ title: 'Slow Down', description: `You can open another ticket <t:${Math.floor(cooldownExpires / 1000)}:R>.`, color: 'warning' })] });
  }

  const open = db.getOpenTicketsForUser(interaction.guild.id, userId);
  if (open.length >= config.limits.maxOpenTicketsPerUser) {
    return safeReply(interaction, { embeds: [embeds.statusEmbed({ title: 'Too Many Open Tickets', description: `You already have ${open.length} open ticket(s). Please close an existing ticket before opening another.`, color: 'warning' })] });
  }

  const modal = forms.buildCategoryModal(categoryKey);
  await interaction.showModal(modal);
}

// ---------------------------------------------------------------------------
// Modal submissions
// ---------------------------------------------------------------------------
async function handleModalSubmit(interaction) {
  const id = interaction.customId;

  if (id.startsWith('ticket:modal:rename')) return handleRenameModal(interaction);
  if (id.startsWith('ticket:modal:note')) return handleNoteModal(interaction);
  if (id.startsWith('ticket:modal:close_reason')) return handleCloseReasonModal(interaction);
  if (id.startsWith('ticket:modal:rating_comment_')) return handleRatingCommentModal(interaction);

  // Otherwise it's a category form submission: ticket:modal:<categoryKey>
  const categoryKey = id.replace('ticket:modal:', '');
  const category = config.categories[categoryKey];
  if (!category) return safeReply(interaction, { content: 'Unknown ticket category.' });

  const data = forms.parseModalSubmission(interaction, categoryKey);
  const errors = forms.validateFormData(categoryKey, data);
  if (errors.length) {
    return safeReply(interaction, {
      embeds: [embeds.statusEmbed({ title: '⚠️ Please Fix the Following', description: errors.map(e => `• ${e}`).join('\n'), color: 'warning' })]
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const priority = forms.derivePriority(categoryKey, data);
  const subject = data.subject || data.concern_type || data.issue_type || category.label;

  const { channel, ticket } = await lifecycle.createTicketChannel(
    interaction.guild, interaction.member, categoryKey, data, priority, subject
  );

  db.setCooldown(interaction.user.id, CREATE_COOLDOWN_ACTION, config.limits.ticketCreateCooldownSeconds * 1000);

  const welcome = embeds.ticketWelcomeEmbed(ticket, category, `<@${interaction.user.id}>`);
  const summary = embeds.formSummaryEmbed(category, data);
  const rows = components.ticketControlRow(ticket);

  await channel.send({
    content: `<@${interaction.user.id}> ${mentionStaffRoles(category)}`,
    embeds: [welcome, summary],
    components: rows
  });

  await interaction.editReply({
    embeds: [embeds.statusEmbed({ title: '✅ Ticket Created', description: `Your ticket has been created: ${channel}`, color: 'success' })]
  });
}

function mentionStaffRoles(category) {
  const mentions = category.accessRoles
    .map(k => config.permissions.roles[k])
    .filter(id => id && id !== 'REPLACE_ROLE_ID')
    .map(id => `<@&${id}>`);
  return [...new Set(mentions)].join(' ');
}

async function handleRenameModal(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });
  const newName = interaction.fields.getTextInputValue('new_name');
  await lifecycle.renameTicket(interaction.channel, ticket, newName, interaction.user.id);
  await safeReply(interaction, { embeds: [embeds.statusEmbed({ title: '✏️ Renamed', description: `Channel renamed to \`${interaction.channel.name}\`.`, color: 'success' })] });
}

async function handleNoteModal(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });
  const content = interaction.fields.getTextInputValue('note_content');
  db.addNote(ticket.id, interaction.user.id, content);
  db.logEvent(ticket.id, interaction.user.id, 'note_added');
  await safeReply(interaction, { embeds: [embeds.statusEmbed({ title: '📝 Note Saved', description: 'Your internal note has been recorded.', color: 'success' })] });
}

async function handleCloseReasonModal(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });
  const reason = interaction.fields.getTextInputValue('close_reason') || 'No reason provided';
  await finalizeClose(interaction, ticket, reason);
}

async function handleRatingCommentModal(interaction) {
  const rating = parseInt(interaction.customId.split('_').pop(), 10);
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });
  const comment = interaction.fields.getTextInputValue('rating_comment') || null;

  db.setRating(ticket.id, rating, comment);
  if (ticket.claimed_by) db.recordRating(ticket.claimed_by, rating);
  db.logEvent(ticket.id, interaction.user.id, 'rated', String(rating));

  const category = config.categories[ticket.category_key];
  await safeReply(interaction, { embeds: [embeds.statusEmbed({ title: '⭐ Thank You!', description: 'Your feedback has been recorded.', color: 'success' })] });

  const logChannelId = config.channels.ratingLogChannelId;
  if (logChannelId && logChannelId !== 'REPLACE_WITH_CHANNEL_ID') {
    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) {
      await logChannel.send({ embeds: [embeds.ratingEmbed(ticket, category, rating, comment, interaction.user.id)] }).catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
async function handleButton(interaction) {
  const action = interaction.customId.replace('ticket:', '');
  const ticket = getTicketOrWarn(interaction);
  if (!ticket) return;

  const category = config.categories[ticket.category_key];
  const member = interaction.member;
  const isStaffMember = perms.isStaff(member);

  switch (action) {
    case 'claim': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can claim tickets.' });
      if (ticket.claimed_by) return safeReply(interaction, { content: 'This ticket is already claimed.' });
      const updated = lifecycle.claim(ticket, member.id);
      lifecycle.noteFirstResponseIfNeeded(updated, member.id);
      await interaction.update({ components: components.ticketControlRow(updated) });
      await interaction.channel.send({ embeds: [embeds.statusEmbed({ title: '🙋 Ticket Claimed', description: `${member} has claimed this ticket and will be assisting you.`, color: 'success' })] });
      return;
    }

    case 'priority': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can change priority.' });
      return safeReply(interaction, { content: 'Select the new priority:', components: [components.priorityMenuRow()] });
    }

    case 'lock': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can lock tickets.' });
      await lifecycle.lockTicket(interaction.channel, ticket, member.id);
      const updated = db.getTicketById(ticket.id);
      await interaction.update({ components: components.ticketControlRow(updated) });
      await interaction.channel.send({ embeds: [embeds.statusEmbed({ title: '🔒 Ticket Locked', description: 'This ticket has been locked by staff.', color: 'warning' })] });
      return;
    }

    case 'unlock': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can unlock tickets.' });
      await lifecycle.unlockTicket(interaction.channel, ticket, member.id);
      const updated = db.getTicketById(ticket.id);
      await interaction.update({ components: components.ticketControlRow(updated) });
      await interaction.channel.send({ embeds: [embeds.statusEmbed({ title: '🔓 Ticket Unlocked', description: 'This ticket has been unlocked.', color: 'success' })] });
      return;
    }

    case 'transfer': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can transfer tickets.' });
      return safeReply(interaction, { content: 'Transfer this ticket to which department?', components: [components.transferCategorySelectMenu(ticket.category_key)] });
    }

    case 'add_user': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can add users.' });
      return safeReply(interaction, { content: 'Select a user to add to this ticket:', components: [components.userSelectRow('ticket:add_user_select', 'Select a user to add...')] });
    }

    case 'remove_user': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can remove users.' });
      return safeReply(interaction, { content: 'Select a user to remove from this ticket:', components: [components.userSelectRow('ticket:remove_user_select', 'Select a user to remove...')] });
    }

    case 'rename': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can rename tickets.' });
      return interaction.showModal(forms.buildRenameModal(interaction.channel.name));
    }

    case 'note': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can add internal notes.' });
      return interaction.showModal(forms.buildNoteModal());
    }

    case 'info': {
      return safeReply(interaction, { embeds: [embeds.ticketInfoEmbed(ticket, category)] });
    }

    case 'escalate': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can escalate tickets.' });
      const updated = lifecycle.escalate(ticket, member.id);
      const p = config.priorities[updated.priority];
      await interaction.reply({ embeds: [embeds.statusEmbed({ title: '⬆️ Ticket Escalated', description: `Priority raised to ${p.emoji} **${p.label}**.`, color: 'warning' })] });
      return;
    }

    case 'close': {
      if (ticket.status === 'closed') return safeReply(interaction, { content: 'This ticket is already closed.' });
      return safeReply(interaction, { embeds: [embeds.statusEmbed({ title: 'Close this ticket?', description: 'This will lock the channel and generate a transcript. This action can be reversed with **Reopen**.', color: 'warning' })], components: [components.closeConfirmRow()] });
    }

    case 'close_confirm': {
      if (isStaffMember) {
        return interaction.showModal(forms.buildCloseReasonModal());
      }
      await interaction.deferUpdate();
      await finalizeClose(interaction, ticket, 'Closed by ticket opener');
      return;
    }

    case 'close_cancel': {
      await interaction.update({ embeds: [embeds.statusEmbed({ title: 'Cancelled', description: 'Ticket close cancelled.', color: 'neutral' })], components: [] });
      return;
    }

    case 'reopen': {
      if (!isStaffMember) return safeReply(interaction, { content: 'Only staff can reopen tickets.' });
      const updated = db.reopenTicket(ticket.id);
      await interaction.channel.permissionOverwrites.edit(ticket.opener_id, { ViewChannel: true, SendMessages: true });
      db.logEvent(ticket.id, member.id, 'reopened');
      await interaction.update({ embeds: [embeds.statusEmbed({ title: '🔓 Ticket Reopened', description: `Reopened by ${member}.`, color: 'success' })], components: components.ticketControlRow(updated) });
      return;
    }

    case 'transcript': {
      const notes = db.getNotes(ticket.id);
      const events = db.getEvents(ticket.id);
      const filePath = await generateTranscript(interaction.channel, ticket, category, notes, events);
      await safeReply(interaction, { content: 'Here is the transcript for this ticket:', files: [filePath] });
      return;
    }

    case 'delete': {
      if (!perms.canPerformAction(member, 'delete_ticket')) {
        return safeReply(interaction, { content: 'You do not have permission to delete tickets.' });
      }
      await safeReply(interaction, { content: 'Deleting this channel in 5 seconds...' });
      db.logEvent(ticket.id, member.id, 'deleted');
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return;
    }

    default: {
      if (action.startsWith('rate_')) return handleRatingButton(interaction, ticket, action);
      return;
    }
  }
}

async function handleRatingButton(interaction, ticket, action) {
  const rating = parseInt(action.split('_')[1], 10);
  if (interaction.user.id !== ticket.opener_id) {
    return safeReply(interaction, { content: 'Only the ticket opener can leave a rating.' });
  }
  return interaction.showModal(forms.buildRatingCommentModal(rating));
}

// ---------------------------------------------------------------------------
// Priority / Transfer / User select menus
// ---------------------------------------------------------------------------
async function handleSetPriority(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });

  const newPriority = interaction.values[0];
  db.updateTicket(ticket.id, { priority: newPriority });
  db.logEvent(ticket.id, interaction.user.id, 'priority_changed', newPriority);

  const p = config.priorities[newPriority];
  await interaction.update({ content: `Priority updated to ${p.emoji} **${p.label}**.`, components: [] });
}

async function handleTransferTarget(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });

  const targetKey = interaction.values[0];
  const category = await lifecycle.transferTicket(ticket, targetKey, interaction.user.id, interaction.guild);

  await interaction.update({ content: `🔁 Ticket transferred to **${category.label}**.`, components: [] });
  await interaction.channel.send({
    embeds: [embeds.statusEmbed({ title: '🔁 Ticket Transferred', description: `This ticket has been transferred to **${category.emoji} ${category.label}**. ${mentionStaffRoles(category)}`, color: 'primary' })]
  });
}

async function handleAddUserSelect(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });

  const userId = interaction.values[0];
  await lifecycle.addUser(interaction.channel, ticket, userId, interaction.user.id);
  await interaction.update({ content: `➕ <@${userId}> has been added to this ticket.`, components: [] });
}

async function handleRemoveUserSelect(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);
  if (!ticket) return safeReply(interaction, { content: 'Not a ticket channel.' });

  const userId = interaction.values[0];
  await lifecycle.removeUser(interaction.channel, ticket, userId, interaction.user.id);
  await interaction.update({ content: `➖ <@${userId}> has been removed from this ticket.`, components: [] });
}

// ---------------------------------------------------------------------------
// Shared close finalization: lock, transcript, log, prompt rating
// ---------------------------------------------------------------------------
async function finalizeClose(interaction, ticket, reason) {
  const category = config.categories[ticket.category_key];
  const notes = db.getNotes(ticket.id);
  const events = db.getEvents(ticket.id);

  const transcriptPath = await generateTranscript(interaction.channel, ticket, category, notes, events);
  const updated = db.closeTicket(ticket.id, interaction.user.id, reason, transcriptPath);
  db.logEvent(ticket.id, interaction.user.id, 'closed', reason);

  if (updated.claimed_by && updated.closed_at) {
    db.recordClose(updated.claimed_by, updated.closed_at - updated.created_at);
  }

  await interaction.channel.permissionOverwrites.edit(ticket.opener_id, { SendMessages: false });

  const closeMsg = await interaction.channel.send({
    embeds: [
      embeds.statusEmbed({ title: '🔒 Ticket Closed', description: `Closed by <@${interaction.user.id}>.\n**Reason:** ${reason}`, color: 'danger' }),
      embeds.statusEmbed({ title: '⭐ Rate Your Experience', description: 'Please let us know how we did! Select a rating below.', color: 'premium' })
    ],
    components: [components.ratingRow(), components.reopenDeleteRow()]
  });

  const logChannelId = config.channels.transcriptLogChannelId;
  if (logChannelId && logChannelId !== 'REPLACE_WITH_CHANNEL_ID') {
    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (logChannel) {
      await logChannel.send({
        embeds: [embeds.statusEmbed({ title: `Ticket #${ticket.ticket_number} Closed`, description: `**Category:** ${category.label}\n**Opener:** <@${ticket.opener_id}>\n**Closed by:** <@${interaction.user.id}>\n**Reason:** ${reason}`, color: 'neutral' })],
        files: [transcriptPath]
      }).catch(() => {});
    }
  }

  if (interaction.replied || interaction.deferred) {
    await safeReply(interaction, { content: 'Ticket closed.' }).catch(() => {});
  }

  return closeMsg;
}