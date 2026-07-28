'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'tickets.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS tickets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number     INTEGER NOT NULL,
  channel_id        TEXT UNIQUE NOT NULL,
  guild_id          TEXT NOT NULL,
  category_key      TEXT NOT NULL,
  opener_id         TEXT NOT NULL,
  claimed_by        TEXT,
  priority          TEXT NOT NULL DEFAULT 'medium',
  status            TEXT NOT NULL DEFAULT 'open',   -- open | claimed | locked | closed
  subject           TEXT,
  form_data         TEXT,                            -- JSON blob of submitted form answers
  added_users       TEXT DEFAULT '[]',                -- JSON array of extra user ids
  created_at        INTEGER NOT NULL,
  claimed_at        INTEGER,
  first_response_at INTEGER,
  closed_at         INTEGER,
  closed_by         TEXT,
  close_reason      TEXT,
  reopened_count    INTEGER NOT NULL DEFAULT 0,
  transcript_path   TEXT,
  rating            INTEGER,
  rating_comment    TEXT
);

CREATE TABLE IF NOT EXISTS ticket_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id    TEXT,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_stats (
  staff_id          TEXT PRIMARY KEY,
  tickets_claimed   INTEGER NOT NULL DEFAULT 0,
  tickets_closed    INTEGER NOT NULL DEFAULT 0,
  total_response_ms INTEGER NOT NULL DEFAULT 0,
  response_count    INTEGER NOT NULL DEFAULT 0,
  total_resolve_ms  INTEGER NOT NULL DEFAULT 0,
  resolve_count     INTEGER NOT NULL DEFAULT 0,
  rating_sum        INTEGER NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blacklist (
  user_id     TEXT PRIMARY KEY,
  reason      TEXT,
  added_by    TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cooldowns (
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, action)
);

CREATE TABLE IF NOT EXISTS counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`);

// ---- Counter helpers (used for sequential ticket numbers) ----
function nextTicketNumber(startingNumber) {
  const row = db.prepare('SELECT value FROM counters WHERE key = ?').get('ticket_number');
  if (!row) {
    db.prepare('INSERT INTO counters (key, value) VALUES (?, ?)').run('ticket_number', startingNumber);
    return startingNumber;
  }
  const next = row.value + 1;
  db.prepare('UPDATE counters SET value = ? WHERE key = ?').run(next, 'ticket_number');
  return next;
}

// ---- Ticket CRUD ----
function createTicket({ ticketNumber, channelId, guildId, categoryKey, openerId, priority, subject, formData }) {
  const stmt = db.prepare(`
    INSERT INTO tickets (ticket_number, channel_id, guild_id, category_key, opener_id, priority, status, subject, form_data, created_at)
    VALUES (@ticketNumber, @channelId, @guildId, @categoryKey, @openerId, @priority, 'open', @subject, @formData, @createdAt)
  `);
  const info = stmt.run({
    ticketNumber, channelId, guildId, categoryKey, openerId, priority,
    subject: subject || null,
    formData: JSON.stringify(formData || {}),
    createdAt: Date.now()
  });
  return getTicketById(info.lastInsertRowid);
}

function getTicketById(id) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
}

function getTicketByChannel(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
}

function getOpenTicketsForUser(guildId, userId) {
  return db.prepare(`
    SELECT * FROM tickets
    WHERE guild_id = ? AND opener_id = ? AND status != 'closed'
  `).all(guildId, userId);
}

function updateTicket(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return getTicketById(id);
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE tickets SET ${setClause} WHERE id = @id`).run({ ...fields, id });
  return getTicketById(id);
}

function claimTicket(id, staffId) {
  return updateTicket(id, { claimed_by: staffId, status: 'claimed', claimed_at: Date.now() });
}

function setFirstResponse(id) {
  const t = getTicketById(id);
  if (t && !t.first_response_at) {
    return updateTicket(id, { first_response_at: Date.now() });
  }
  return t;
}

function closeTicket(id, closedBy, reason, transcriptPath) {
  return updateTicket(id, {
    status: 'closed',
    closed_at: Date.now(),
    closed_by: closedBy,
    close_reason: reason || null,
    transcript_path: transcriptPath || null
  });
}

function reopenTicket(id) {
  const t = getTicketById(id);
  return updateTicket(id, {
    status: t.claimed_by ? 'claimed' : 'open',
    closed_at: null,
    closed_by: null,
    reopened_count: (t.reopened_count || 0) + 1
  });
}

function setRating(id, rating, comment) {
  return updateTicket(id, { rating, rating_comment: comment || null });
}

function addUserToTicket(id, userId) {
  const t = getTicketById(id);
  const users = new Set(JSON.parse(t.added_users || '[]'));
  users.add(userId);
  return updateTicket(id, { added_users: JSON.stringify([...users]) });
}

function removeUserFromTicket(id, userId) {
  const t = getTicketById(id);
  const users = new Set(JSON.parse(t.added_users || '[]'));
  users.delete(userId);
  return updateTicket(id, { added_users: JSON.stringify([...users]) });
}

// ---- Notes ----
function addNote(ticketId, authorId, content) {
  db.prepare('INSERT INTO ticket_notes (ticket_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
    .run(ticketId, authorId, content, Date.now());
}

function getNotes(ticketId) {
  return db.prepare('SELECT * FROM ticket_notes WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
}

// ---- Events / Audit log ----
function logEvent(ticketId, actorId, action, detail) {
  db.prepare('INSERT INTO ticket_events (ticket_id, actor_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(ticketId, actorId || null, action, detail || null, Date.now());
}

function getEvents(ticketId) {
  return db.prepare('SELECT * FROM ticket_events WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
}

// ---- Staff stats ----
function ensureStaffRow(staffId) {
  db.prepare('INSERT OR IGNORE INTO staff_stats (staff_id) VALUES (?)').run(staffId);
}

function recordClaim(staffId) {
  ensureStaffRow(staffId);
  db.prepare('UPDATE staff_stats SET tickets_claimed = tickets_claimed + 1 WHERE staff_id = ?').run(staffId);
}

function recordFirstResponse(staffId, ms) {
  ensureStaffRow(staffId);
  db.prepare('UPDATE staff_stats SET total_response_ms = total_response_ms + ?, response_count = response_count + 1 WHERE staff_id = ?')
    .run(ms, staffId);
}

function recordClose(staffId, resolveMs) {
  ensureStaffRow(staffId);
  db.prepare('UPDATE staff_stats SET tickets_closed = tickets_closed + 1, total_resolve_ms = total_resolve_ms + ?, resolve_count = resolve_count + 1 WHERE staff_id = ?')
    .run(resolveMs, staffId);
}

function recordRating(staffId, rating) {
  ensureStaffRow(staffId);
  db.prepare('UPDATE staff_stats SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE staff_id = ?')
    .run(rating, staffId);
}

function getStaffLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT * FROM staff_stats
    ORDER BY tickets_closed DESC, tickets_claimed DESC
    LIMIT ?
  `).all(limit);
}

// ---- Blacklist ----
function isBlacklisted(userId) {
  return !!db.prepare('SELECT 1 FROM blacklist WHERE user_id = ?').get(userId);
}

function addBlacklist(userId, reason, addedBy) {
  db.prepare('INSERT OR REPLACE INTO blacklist (user_id, reason, added_by, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, reason || null, addedBy, Date.now());
}

function removeBlacklist(userId) {
  db.prepare('DELETE FROM blacklist WHERE user_id = ?').run(userId);
}

// ---- Cooldowns ----
function getCooldown(userId, action) {
  const row = db.prepare('SELECT expires_at FROM cooldowns WHERE user_id = ? AND action = ?').get(userId, action);
  if (!row) return 0;
  if (row.expires_at < Date.now()) return 0;
  return row.expires_at;
}

function setCooldown(userId, action, durationMs) {
  const expiresAt = Date.now() + durationMs;
  db.prepare(`
    INSERT INTO cooldowns (user_id, action, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id, action) DO UPDATE SET expires_at = excluded.expires_at
  `).run(userId, action, expiresAt);
  return expiresAt;
}

// ---- Analytics aggregates ----
function getAnalytics(guildId, sinceMs = 0) {
  const base = db.prepare(`SELECT * FROM tickets WHERE guild_id = ? AND created_at >= ?`).all(guildId, sinceMs);
  const total = base.length;
  const open = base.filter(t => t.status !== 'closed').length;
  const closed = base.filter(t => t.status === 'closed').length;

  const responded = base.filter(t => t.first_response_at);
  const avgResponseMs = responded.length
    ? responded.reduce((sum, t) => sum + (t.first_response_at - t.created_at), 0) / responded.length
    : 0;

  const resolved = base.filter(t => t.closed_at);
  const avgResolveMs = resolved.length
    ? resolved.reduce((sum, t) => sum + (t.closed_at - t.created_at), 0) / resolved.length
    : 0;

  const rated = base.filter(t => t.rating != null);
  const avgRating = rated.length ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : null;

  const byCategory = {};
  for (const t of base) byCategory[t.category_key] = (byCategory[t.category_key] || 0) + 1;

  const hourBuckets = new Array(24).fill(0);
  for (const t of base) hourBuckets[new Date(t.created_at).getHours()]++;

  return { total, open, closed, avgResponseMs, avgResolveMs, avgRating, ratedCount: rated.length, byCategory, hourBuckets };
}

module.exports = {
  db,
  nextTicketNumber,
  createTicket,
  getTicketById,
  getTicketByChannel,
  getOpenTicketsForUser,
  updateTicket,
  claimTicket,
  setFirstResponse,
  closeTicket,
  reopenTicket,
  setRating,
  addUserToTicket,
  removeUserFromTicket,
  addNote,
  getNotes,
  logEvent,
  getEvents,
  recordClaim,
  recordFirstResponse,
  recordClose,
  recordRating,
  getStaffLeaderboard,
  isBlacklisted,
  addBlacklist,
  removeBlacklist,
  getCooldown,
  setCooldown,
  getAnalytics
};