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

        const mongoText = mongoStatus.connected
            ? `🗄️ **Database:** ✅ ${mongoStatus.latency}ms`
            : `🗄️ **Database:** ❌ disconnected`;

        
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
                        new TextDisplayBuilder().setContent(`⏱️ **Bot Latency:** ${roundTripLatency}ms`),
                        new TextDisplayBuilder().setContent(`💓 **API Latency:** ${apiLatency}ms`),
                        new TextDisplayBuilder().setContent(mongoText)
                    )
            ]
        });
    }
}