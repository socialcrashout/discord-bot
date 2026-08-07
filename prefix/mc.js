const { MessageFlags } = require("discord.js");
const { getDB } = require("../db");

module.exports = {
    name: "mc",

    execute: async (message, args, client) => {
        const guild = message.guild;

        const totalMembers = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount || 0;

        // --- Compute net growth (joins - leaves) over each window ---
        const db = getDB();
        const collection = db.collection("memberStats");

        const now = Date.now();
        const DAY_MS = 24 * 60 * 60 * 1000;

        async function netGrowthSince(msAgo) {
            const cutoff = now - msAgo;
            const [joins, leaves] = await Promise.all([
                collection.countDocuments({ type: "join", timestamp: { $gte: cutoff } }),
                collection.countDocuments({ type: "leave", timestamp: { $gte: cutoff } })
            ]);
            return joins - leaves;
        }

        const [growth24h, growth7d, growth30d] = await Promise.all([
            netGrowthSince(DAY_MS),
            netGrowthSince(7 * DAY_MS),
            netGrowthSince(30 * DAY_MS)
        ]);

        // Format with a +/- sign so growth vs decline is obvious
        const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);

        const container = {
            type: 17,
            components: [
                {
                    type: 10,
                    content: `
<:person:1502514200705105981> **Total Members:** ${totalMembers.toLocaleString()}
<:boost:1532100194840219849> **Server Boosts:** ${boosts}

<:stats:1532105130877517966> **Growth Statistics:**
<:Dot:1502513706347528213> Past 24 Hours: ${fmt(growth24h)}
<:Dot:1502513706347528213> Past 7 Days: ${fmt(growth7d)}
<:Dot:1502513706347528213> Past 30 Days: ${fmt(growth30d)}
`
                },
                {
                    type: 12,
                    items: [
                        {
                            media: {
                                url: "https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw"
                            }
                        }
                    ]
                }
            ]
        };

        await message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    },
};