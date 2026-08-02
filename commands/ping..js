const { SlashCommandBuilder, ContainerBuilder, MessageFlags, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js')
const { getDB } = require('../db')

function formatUptime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
}

async function getMongoStatus() {
    try {
        const db = getDB();
        const start = Date.now();
        await db.command({ ping: 1 });
        const latency = Date.now() - start;
        return { connected: true, latency };
    } catch (err) {
        return { connected: false, latency: null };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
    .setName(`ping`)
    .setDescription(`responds with pong`),

    async execute(interaction) {

        const sent = await interaction.reply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('Pinging')
                    )
            ],
            fetchReply: true
        });

        const roundTripLatency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        const uptime = formatUptime(interaction.client.uptime);
        const mongoStatus = await getMongoStatus();

        const mongoText = mongoStatus.connected
            ? ` **Database:** ✅ \`${mongoStatus.latency}ms\``
            : ` **Database:** ❌ \`disconnected\``;

        await interaction.editReply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
                new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('**Pong**') 
                )
                .addSeparatorComponents(
                    new SeparatorBuilder()
                    .setDivider(true)
                    .setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(' **Bot Latency:** `' + roundTripLatency + 'ms`'),
                        new TextDisplayBuilder().setContent(' **API Latency:** `' + apiLatency + 'ms`'),
                        new TextDisplayBuilder().setContent(' **Total Uptime:** `' + uptime + '`'),
                        new TextDisplayBuilder().setContent(mongoText)
                )
            ]
        })
    }
}