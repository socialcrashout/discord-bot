const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits, TextDisplayBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const transcripts = require('discord-html-transcripts');
const config = require('./config');
const store = require('./ticket');

const category = (id) => config.categories.find((c) => c.id === id);
const staff = (member) => member?.roles.cache.has(config.adminRoleId) || member?.roles.cache.has(config.supportRoleId);
const name = (s) => s.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
const container = (color, strings) => new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(strings.filter(Boolean).map((s) => new TextDisplayBuilder().setContent(s)));

function panelPayload() {
  const sections = config.categories.map((c) => `## ${c.emoji} ${c.label}\n> ${c.description}`).join('\n');
  const panel = container(0xF97316, ['# 📌 Welcome to Popeyes Assistance!', 'Please select the ticket option below. Do not ping staff members inside your ticket. Inactive tickets may close after **12 consecutive hours**.', sections, '### Powered by tickets.bot']);
  if (config.panelBannerUrl) panel.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.panelBannerUrl).setDescription('Ticket banner')));
  panel.addActionRowComponents(new ActionRowBuilder().addComponents(...config.categories.map((c) => new ButtonBuilder().setCustomId(`ticket:open:${c.id}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Secondary))));
  return { components: [panel], flags: MessageFlags.IsComponentsV2 };
}

function ticketPayload(ticket) {
  const c = category(ticket.category) || { label: 'Ticket', emoji: '🎫', color: 0xF97316 };
  const panel = container(c.color, [`# ${c.emoji} ${c.label} Inquiry`, `**Ticket ID:** \`${ticket.number}\`\n**Opened by:** <@${ticket.openerId}>\n**Status:** ${ticket.claimedBy ? `Claimed by <@${ticket.claimedBy}>` : 'Waiting for staff'}`, `**Subject:** ${ticket.subject}\n${ticket.details}`, 'The ticket opener cannot close this ticket. Please do not ping staff.', '### Powered by tickets.bot']);
  panel.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:claim').setLabel(ticket.claimedBy ? 'Claimed' : 'Claim').setEmoji('🧑‍💼').setStyle(ButtonStyle.Success).setDisabled(!!ticket.claimedBy),
    new ButtonBuilder().setCustomId('ticket:unclaim').setLabel('Unclaim').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:add').setLabel('Add user').setEmoji('➕').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket:remove').setLabel('Remove user').setEmoji('➖').setStyle(ButtonStyle.Secondary)
  ));
  return { components: [panel], flags: MessageFlags.IsComponentsV2 };
}

async function showOpenModal(interaction, id) {
  const c = category(id); if (!c) return;
  const modal = new ModalBuilder().setCustomId(`ticket:details:${id}`).setTitle(`${c.label} ticket`);
  modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)), new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('details').setLabel('How can we help?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)));
  await interaction.showModal(modal);
}

async function createTicket(interaction, id, subject, details) {
  await interaction.deferReply({ ephemeral: true });
  const c = category(id); if (!c) return interaction.editReply('That ticket category does not exist.');
  const existing = (await store.openTickets()).find((t) => t.openerId === interaction.user.id);
  if (existing) return interaction.editReply(`You already have an open ticket: <#${existing.channelId}>`);
  const number = await store.nextTicketNumber();
  const channel = await interaction.guild.channels.create({ name: `${name(c.id)}-${name(interaction.user.username)}-${String(number).padStart(4, '0')}`, type: ChannelType.GuildText, parent: config.parentCategoryId || undefined, permissionOverwrites: [
    { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: config.adminRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: config.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ] });
  const ticket = { channelId: channel.id, number, openerId: interaction.user.id, category: id, subject, details, openedAt: Date.now(), claimedBy: null };
  await store.saveTicket(ticket); await channel.send({ content: `<@${ticket.openerId}> <@&${config.adminRoleId}> <@&${config.supportRoleId}>`, ...ticketPayload(ticket) });
  await interaction.editReply(`Your ticket has been created: ${channel}`);
}

async function requireStaff(interaction, ticket) {
  if (!ticket) { await interaction.reply({ content: 'This is not an active ticket.', ephemeral: true }); return false; }
  if (!staff(interaction.member)) { await interaction.reply({ content: 'Only ticket staff can use this.', ephemeral: true }); return false; }
  return true;
}

async function handleTicketButton(interaction) {
  const [, action, value] = interaction.customId.split(':');
  if (action === 'open') return showOpenModal(interaction, value);
  const ticket = await store.getTicket(interaction.channelId); if (!(await requireStaff(interaction, ticket))) return;
  if (action === 'claim') { ticket.claimedBy = interaction.user.id; await store.saveTicket(ticket); await interaction.channel.permissionOverwrites.edit(config.supportRoleId, { SendMessages: false }); await interaction.channel.permissionOverwrites.edit(interaction.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); return interaction.update(ticketPayload(ticket)); }
  if (action === 'unclaim') { if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id && !interaction.member.roles.cache.has(config.adminRoleId)) return interaction.reply({ content: 'Only the claimer or an admin can unclaim this ticket.', ephemeral: true }); ticket.claimedBy = null; await store.saveTicket(ticket); await interaction.channel.permissionOverwrites.edit(config.supportRoleId, { SendMessages: true }); return interaction.update(ticketPayload(ticket)); }
  if (action === 'close') { const modal = new ModalBuilder().setCustomId('ticket:close-reason').setTitle('Close ticket'); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason for closure').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))); return interaction.showModal(modal); }
  const modal = new ModalBuilder().setCustomId(`ticket:${action}-user`).setTitle(`${action === 'add' ? 'Add' : 'Remove'} ticket user`); modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('userId').setLabel('User ID').setPlaceholder('Copy User ID with Developer Mode').setStyle(TextInputStyle.Short).setRequired(true))); return interaction.showModal(modal);
}

async function closeTicket(interaction, reason) {
  const ticket = await store.getTicket(interaction.channelId); if (!(await requireStaff(interaction, ticket))) return;
  await interaction.deferReply({ ephemeral: true });
  const transcript = await transcripts.createTranscript(interaction.channel, { poweredBy: false, saveImages: true, filename: `ticket-${ticket.number}.html` });
  const log = interaction.guild.channels.cache.get(config.logChannelId);
  if (log?.isTextBased()) { const c = category(ticket.category); await log.send({ components: [container(0x22C55E, ['# Ticket Closed', `**Ticket ID**\n${ticket.number}\n\n**Opened By**\n<@${ticket.openerId}>\n\n**Closed By**\n<@${interaction.user.id}>\n\n**Claimed By**\n${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Not claimed'}\n\n**Category**\n${c?.label || ticket.category}\n\n**Reason**\n${reason}`])], files: [transcript], flags: MessageFlags.IsComponentsV2 }); }
  await store.removeTicket(ticket.channelId); await interaction.editReply('Ticket closed. This channel will be deleted in 5 seconds.'); setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);
}

async function handleUserModal(interaction, action) { const ticket = await store.getTicket(interaction.channelId); if (!(await requireStaff(interaction, ticket))) return; const id = interaction.fields.getTextInputValue('userId').trim(); const member = await interaction.guild.members.fetch(id).catch(() => null); if (!member) return interaction.reply({ content: 'I could not find that user in this server.', ephemeral: true }); if (action === 'add') await interaction.channel.permissionOverwrites.edit(id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }); else await interaction.channel.permissionOverwrites.delete(id); await interaction.reply({ content: `${action === 'add' ? 'Added' : 'Removed'} ${member} ${action === 'add' ? 'to' : 'from'} this ticket.`, ephemeral: true }); }
async function renameCurrentTicket(message, value) { const ticket = await store.getTicket(message.channelId); if (!ticket || !staff(message.member)) return false; if (!value) { await message.reply('Usage: `-rename new-ticket-name`'); return true; } await message.channel.setName(name(value)); await message.reply('Ticket renamed.'); return true; }

module.exports = { panelPayload, createTicket, handleTicketButton, closeTicket, handleUserModal, renameCurrentTicket };
