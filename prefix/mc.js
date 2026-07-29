const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "memberStats.json");

module.exports = {
    name: "mc",

    async execute(message) {
        const guild = message.guild;

        const totalMembers = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount || 0;

        let history = [];

        if (fs.existsSync(dataPath)) {
            history = JSON.parse(fs.readFileSync(dataPath, "utf8")).history || [];
        }

        const now = Date.now();

        const calcGrowth = (days) => {
            const cutoff = now - (days * 24 * 60 * 60 * 1000);

            let joins = 0;
            let leaves = 0;

            for (const event of history) {
                if (event.timestamp >= cutoff) {
                    if (event.type === "join") joins++;
                    if (event.type === "leave") leaves++;
                }
            }

            return joins - leaves;
        };

        const growth24 = calcGrowth(1);
        const growth7 = calcGrowth(7);
        const growth30 = calcGrowth(30);

        const format = (num) => {
            if (num > 0) return `+${num}`;
            return `${num}`;
        };

        const embed = new EmbedBuilder()
            .setDescription(`
<:person:1502514200705105981> **Total Members**
> ${totalMembers.toLocaleString()}

<:boost:1532100194840219849> **Server Boosts**
> ${boosts}

<:stats_nlc:1532100287215440115> **Growth Statistics**
> **Past 24 Hours:** ${format(growth24)}
> **Past 7 Days:** ${format(growth7)}
> **Past 30 Days:** ${format(growth30)}
`)
            .setImage("https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw");

        await message.channel.send({
            embeds: [embed]
        });
    }
};