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

// Shape: { "<guildId>": [ { caseNumber, userId, userTag, moderatorId, moderatorTag, reason, timestamp } ] }

function addWarning(guildId, entry) {
  const data = readData();
  if (!data[guildId]) data[guildId] = [];
  data[guildId].push(entry);
  writeData(data);
}

function getWarningsForUser(guildId, userId) {
  const data = readData();
  const guildWarnings = data[guildId] || [];
  return guildWarnings.filter(w => w.userId === userId);
}

// Returns the removed warning, or null if no warning with that case number exists
function removeWarningByCase(guildId, caseNumber) {
  const data = readData();
  const guildWarnings = data[guildId] || [];
  const index = guildWarnings.findIndex(w => w.caseNumber === caseNumber);

  if (index === -1) return null;

  const [removed] = guildWarnings.splice(index, 1);
  data[guildId] = guildWarnings;
  writeData(data);
  return removed;
}

module.exports = { addWarning, getWarningsForUser, removeWarningByCase };