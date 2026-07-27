const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'cases.json');

function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // File doesn't exist yet (first run) or is empty/invalid — start fresh
    return {};
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Returns the next case number for a guild, persisted in data/cases.json
// Shape: { "<guildId>": <lastCaseNumber>, ... }
function getNextCase(guildId) {
  const data = readData();
  const next = (data[guildId] || 0) + 1;
  data[guildId] = next;
  writeData(data);
  return next;
}

module.exports = getNextCase;