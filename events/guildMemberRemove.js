const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "memberStats.json");

module.exports = {
    name: "guildMemberRemove",

    async execute(member) {
        let data = { history: [] };

        if (fs.existsSync(dataPath)) {
            data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
        }

        data.history.push({
            type: "leave",
            timestamp: Date.now()
        });

        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        data.history = data.history.filter(x => x.timestamp >= cutoff);

        fs.writeFileSync(dataPath, JSON.stringify(data, null, 4));
    }
};