const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'warnings.json');

function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {}; 
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Shape: { "<guildId>": [ { caseNumber, type, userId, userTag, moderatorId, moderatorTag, reason, timestamp } ] }
// type is one of: 'warn', 'kick', 'ban', 'timeout'

function addModLog(guildId, entry) {
  const data = readData();
  if (!data[guildId]) data[guildId] = [];
  data[guildId].push(entry);
  writeData(data);
}

function getLogsForUser(guildId, userId) {
  const data = readData();
  const guildLogs = data[guildId] || [];
  return guildLogs
    .filter(log => log.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Returns the removed entry, or null if no case with that number exists
function removeLogByCase(guildId, caseNumber) {
  const data = readData();
  const guildLogs = data[guildId] || [];
  const index = guildLogs.findIndex(l => l.caseNumber === caseNumber);

  if (index === -1) return null;

  const [removed] = guildLogs.splice(index, 1);
  data[guildId] = guildLogs;
  writeData(data);
  return removed;
}

// --- Backwards-compatible aliases so existing warn.js keeps working untouched ---
function addWarning(guildId, entry) {
  addModLog(guildId, { ...entry, type: entry.type || 'warn' });
}

function getWarningsForUser(guildId, userId) {
  return getLogsForUser(guildId, userId).filter(l => l.type === 'warn');
}

function removeWarningByCase(guildId, caseNumber) {
  return removeLogByCase(guildId, caseNumber);
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