const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = "-";

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "mc" && args[0] === "v2") {

        const guild = message.guild;

        const totalMembers = guild.memberCount;
        const boosts = guild.premiumSubscriptionCount || 0;

        const embed = new EmbedBuilder()
            .setDescription(`
<:person:1502514200705105981> **Total members:** ${totalMembers.toLocaleString()}

<:boost:1532100194840219849> **Boosts:** ${boosts}

<:stats_nlc:1532100287215440115> **Growth statistics:**
Past 24h: (-8)
Past 7d: (-4)
Past month: (+128)

━━━━━━━━━━━━━━━━━━━━

**Bringing your vision to life.**
            `)
            .setImage("YOUR_BANNER_IMAGE_URL");

        await message.channel.send({
            embeds: [embed]
        });
    }
});

client.login("BOT_TOKEN");