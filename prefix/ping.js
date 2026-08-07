const { Message, Client, ContainerBuilder, MessageFlags, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js')
const { getDB } = require('../db')

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

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

module.exports = {
    name: 'ping',
    description: 'replies with pong and latency'

    /** 
     * @param {Message} message
     * @param {string[]} args
     * @param {Client} client
    */,
    async execute(message, args, client) {
        
        const sent = await message.reply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('Pinging...')
                    )
            ]
        });

        
        const roundTripLatency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        const mongoStatus = await getMongoStatus();
        const uptime = formatUptime(process.uptime());

        const mongoText = mongoStatus.connected
            ? `**Database:** Connected ${mongoStatus.latency}ms`
            : `**Database:** Disconnected`;

        
        await sent.edit({
            flags: [MessageFlags.IsComponentsV2],
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('**Pong**')
                    )
                    .addSeparatorComponents(
                        new SeparatorBuilder()
                            .setDivider(true)
                            .setSpacing(SeparatorSpacingSize.Large)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Bot Latency:** ${roundTripLatency}ms`),
                        new TextDisplayBuilder().setContent(`**API Latency:** ${apiLatency}ms`),
                        new TextDisplayBuilder().setContent(`**Total Uptime:** ${uptime}`),
                        new TextDisplayBuilder().setContent(mongoText)
                    )
            ]
        });
    }
}