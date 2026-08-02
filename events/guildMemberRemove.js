const { getDB } = require("../db");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

module.exports = {
    name: "guildMemberRemove",

    async execute(member) {
        const db = getDB();
        const collection = db.collection("memberStats");

        await collection.insertOne({
            type: "leave",
            timestamp: Date.now()
        });

        const cutoff = Date.now() - THIRTY_DAYS_MS;
        await collection.deleteMany({ timestamp: { $lt: cutoff } });
    }
};