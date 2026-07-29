const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "memberStats.json");

module.exports = {
    name: "guildMemberAdd",

    async execute(member) {
        let data = { history: [] };

        if (fs.existsSync(dataPath)) {
            data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        }

        data.history.push({
            type: "join",
            timestamp: Date.now()
        });

        // Keep only the last 30 days
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        data.history = data.history.filter(x => x.timestamp >= cutoff);

        fs.writeFileSync(dataPath, JSON.stringify(data, null, 4));
    }
};