const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'channelLock.json');

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

// Shape: { "<channelId>": previousSendMessagesValue (true|false|null) }

function saveLock(channelId, previousValue) {
  const data = readData();
  data[channelId] = previousValue;
  writeData(data);
}

function getLock(channelId) {
  const data = readData();
  return Object.prototype.hasOwnProperty.call(data, channelId) ? data[channelId] : undefined;
}

function clearLock(channelId) {
  const data = readData();
  delete data[channelId];
  writeData(data);
}

module.exports = { saveLock, getLock, clearLock };