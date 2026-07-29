const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "mc",

    async execute(message) {
        const guild = message.guild;

        const totalMembers = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount || 0;

        const embed = new EmbedBuilder()
            .setDescription(`
<:person:1502514200705105981> **Total Members:** ${totalMembers.toLocaleString()}

<:boost:1532100194840219849> **Boosts:** ${boosts}

<:stats_nlc:1532100287215440115> **Growth Statistics**
**Past 24h:** (-8)
**Past 7d:** (-4)
**Past Month:** (+128)

━━━━━━━━━━━━━━━━━━━━

**Bringing your vision to life.**
            `);

        // Add these if you want:
        // .setFooter({ text: "Your Footer Here", iconURL: "Footer Icon URL" })
        // .setImage("Banner URL")
        embed.setFooter({ text: "Your Footer Here", iconURL: "https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw" });

        await message.channel.send({
            embeds: [embed]
        });
    }
};