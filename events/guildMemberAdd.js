const { getDB } = require("../db");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        const db = getDB();
        const collection = db.collection("memberStats");

        await collection.insertOne({
            type: "join",
            timestamp: Date.now()
        });

        // Keep only the last 30 days — delete anything older
        const cutoff = Date.now() - THIRTY_DAYS_MS;
        await collection.deleteMany({ timestamp: { $lt: cutoff } });
    }
};