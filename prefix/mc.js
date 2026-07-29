const { MessageFlags } = require("discord.js");

module.exports = {
    name: "mc",

    execute: async (message, args, client) => {
        const guild = message.guild;

        const totalMembers = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount || 0;

        const container = {
            type: 17,
            components: [
                {
                    type: 10,
                    content: `
<:person:1502514200705105981> **Total Members:** ${totalMembers.toLocaleString()}
<:boost:1532100194840219849> **Server Boosts:** ${boosts}

<:stats:1532105130877517966> **Growth Statistics:**
<:Dot:1502513706347528213> Past 24 Hours: 0
<:Dot:1502513706347528213> Past 7 Days: 0
<:Dot:1502513706347528213> Past 30 Days: 0
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