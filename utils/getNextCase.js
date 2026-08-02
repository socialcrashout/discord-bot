const { getDB } = require('../db');

// Returns the next case number for a guild, using a counters collection
// Document shape: { _id: guildId, count: <lastCaseNumber> }
async function getNextCase(guildId) {
  const db = getDB();

  const result = await db.collection('caseCounters').findOneAndUpdate(
    { _id: guildId },
    { $inc: { count: 1 } },
    { upsert: true, returnDocument: 'after' }
  );

  return result.value.count;
}

module.exports = getNextCase;