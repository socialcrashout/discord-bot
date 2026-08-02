const { getDB } = require('../db');

// Each document shape:
// { guildId, caseNumber, type, userId, userTag, moderatorId, moderatorTag, reason, timestamp }
// type is one of: 'warn', 'kick', 'ban', 'timeout'

async function addModLog(guildId, entry) {
  const db = getDB();
  await db.collection('warnings').insertOne({ guildId, ...entry });
}

async function getLogsForUser(guildId, userId) {
  const db = getDB();
  const logs = await db.collection('warnings')
    .find({ guildId, userId })
    .sort({ timestamp: -1 })
    .toArray();
  return logs;
}

// Returns the removed entry, or null if no case with that number exists
async function removeLogByCase(guildId, caseNumber) {
  const db = getDB();
  const removed = await db.collection('warnings').findOneAndDelete({ guildId, caseNumber });
  return removed?.value || null;
}

// --- Backwards-compatible aliases so existing warn.js keeps working untouched ---
async function addWarning(guildId, entry) {
  await addModLog(guildId, { ...entry, type: entry.type || 'warn' });
}

async function getWarningsForUser(guildId, userId) {
  const logs = await getLogsForUser(guildId, userId);
  return logs.filter(l => l.type === 'warn');
}

async function removeWarningByCase(guildId, caseNumber) {
  return await removeLogByCase(guildId, caseNumber);
}

module.exports = {
  addModLog,
  getLogsForUser,
  removeLogByCase,
  // legacy names — still used by warn.js
  addWarning,
  getWarningsForUser,
  removeWarningByCase,
};