'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const config = require('../ticketConfig.json');
const db = require('./ticketDb');
const { canAccessCategory } = require('./ticketPermissions');

function formatTicketName(categoryKey, number) {
  const shortKey = categoryKey.replace('_support', '').replace('_relations', '-pr').slice(0, 12);
  return config.naming.format
    .replace('{category}', shortKey)
    .replace('{number}', number);
}

/** Build the permission overwrites for a new ticket channel. */
function buildOverwrites(guild, categoryKey, openerId) {
  const category = config.categories[categoryKey];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: openerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    }
  ];

  for (const roleKey of category.accessRoles) {
    const roleId = config.permissions.roles[roleKey];
    if (roleId) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles
        ]
      });
    }
  }

  return overwrites;
}

async function createTicketChannel(guild, member, categoryKey, formData, priority, subject) {
  const category = config.categories[categoryKey];
  const ticketNumber = db.nextTicketNumber(config.naming.startingNumber);
  const channelName = formatTicketName(categoryKey, ticketNumber);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.channels.ticketCategoryId !== 'REPLACE_WITH_DISCORD_CATEGORY_ID' ? config.channels.ticketCategoryId : undefined,
    topic: `Ticket #${ticketNumber} • ${category.label} • Opened by ${member.user.tag} (${member.id})`,
    permissionOverwrites: buildOverwrites(guild, categoryKey, member.id)
  });

  const ticket = db.createTicket({
    ticketNumber,
    channelId: channel.id,
    guildId: guild.id,
    categoryKey,
    openerId: member.id,
    priority,
    subject,
    formData
  });

  db.logEvent(ticket.id, member.id, 'created', `category=${categoryKey}`);
  return { channel, ticket };
}

async function lockTicket(channel, ticket, actorId) {
  await channel.permissionOverwrites.edit(ticket.opener_id, { SendMessages: false });
  db.updateTicket(ticket.id, { status: 'locked' });
  db.logEvent(ticket.id, actorId, 'locked');
}

async function unlockTicket(channel, ticket, actorId) {
  await channel.permissionOverwrites.edit(ticket.opener_id, { SendMessages: true });
  db.updateTicket(ticket.id, { status: ticket.claimed_by ? 'claimed' : 'open' });
  db.logEvent(ticket.id, actorId, 'unlocked');
}

async function addUser(channel, ticket, userId, actorId) {
  const added = JSON.parse(ticket.added_users || '[]');
  if (added.length >= config.limits.maxAddedUsersPerTicket) {
    throw new Error(`Maximum of ${config.limits.maxAddedUsersPerTicket} added users reached for this ticket.`);
  }
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true, SendMessages: true, ReadMessageHistory: true
  });
  db.addUserToTicket(ticket.id, userId);
  db.logEvent(ticket.id, actorId, 'user_added', userId);
}

async function removeUser(channel, ticket, userId, actorId) {
  await channel.permissionOverwrites.delete(userId).catch(() => {});
  db.removeUserFromTicket(ticket.id, userId);
  db.logEvent(ticket.id, actorId, 'user_removed', userId);
}

async function renameTicket(channel, ticket, newName, actorId) {
  const sanitized = newName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
  await channel.setName(sanitized);
  db.logEvent(ticket.id, actorId, 'renamed', sanitized);
}

async function transferTicket(ticket, newCategoryKey, actorId, guild) {
  const category = config.categories[newCategoryKey];
  if (!category) throw new Error('Unknown target category.');
  const channel = await guild.channels.fetch(ticket.channel_id);

  await channel.permissionOverwrites.set(buildOverwrites(guild, newCategoryKey, ticket.opener_id));

  db.updateTicket(ticket.id, { category_key: newCategoryKey, claimed_by: null, status: 'open' });
  db.logEvent(ticket.id, actorId, 'transferred', newCategoryKey);
  return category;
}

function claim(ticket, staffId) {
  const updated = db.claimTicket(ticket.id, staffId);
  db.recordClaim(staffId);
  db.logEvent(ticket.id, staffId, 'claimed');
  return updated;
}

function escalate(ticket, actorId) {
  const order = ['low', 'medium', 'high', 'urgent'];
  const idx = order.indexOf(ticket.priority);
  const nextPriority = order[Math.min(idx + 1, order.length - 1)];
  const updated = db.updateTicket(ticket.id, { priority: nextPriority });
  db.logEvent(ticket.id, actorId, 'escalated', nextPriority);
  return updated;
}

function noteFirstResponseIfNeeded(ticket, staffId) {
  const wasEmpty = !ticket.first_response_at;
  const updated = db.setFirstResponse(ticket.id);
  if (wasEmpty && updated.first_response_at) {
    db.recordFirstResponse(staffId, updated.first_response_at - updated.created_at);
    db.logEvent(ticket.id, staffId, 'first_response');
  }
  return updated;
}

module.exports = {
  formatTicketName,
  buildOverwrites,
  createTicketChannel,
  lockTicket,
  unlockTicket,
  addUser,
  removeUser,
  renameTicket,
  transferTicket,
  claim,
  escalate,
  noteFirstResponseIfNeeded
};