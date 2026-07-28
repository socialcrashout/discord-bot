const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const LOG_CHANNEL_ID = '1506450870269906944';

// Parses strings like "10s", "5m", "1h" into seconds. Discord's max slowmode is 6 hours.
function parseDuration(input) {
    const match = /^(\d+)\s*(s|m|h)$/i.exec(input.trim());
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1, m: 60, h: 60 * 60 };
    const seconds = amount * multipliers[unit];

    const maxSeconds = 6 * 60 * 60;
    if (seconds > maxSeconds) return null;

    return seconds;
}

module.exports = {
    name: 'slowmode',
    description: 'Set slowmode for this channel',
    // Usage: -slowmode <duration|0>
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return errorReply('You do not have permission to manage channels.');
        }

        const durationInput = args[0];
        if (!durationInput) return errorReply('<:WarningIcon:1508245066135765034> Please provide a duration. Usage: `-slowmode <10s|5m|1h|0>`');

        let seconds;
        if (durationInput.trim() === '0') {
            seconds = 0;
        } else {
            seconds = parseDuration(durationInput);
            if (seconds === null) return errorReply('Invalid duration. Use a format like `10s`, `5m`, `1h` (max 6h), or `0` to disable.');
        }

        try {
            await message.channel.setRateLimitPerUser(seconds);

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Slowmode Command Used!\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                        `**<:person:1502514200705105981> Slowmode Set:** ${seconds === 0 ? 'Disabled' : `${seconds}s`}\n` +
                        `**<:Dot:1502513706347528213> Channel:** ${message.channel}\n` +
                        `**<:Calendar:1502513561866473734> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    )
                );

                await logChannel.send({
                    components: [logContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                });
            }

            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    seconds === 0
                        ? `**Slowmode disabled** in ${message.channel}`
                        : `**Slowmode set to ${seconds}s** in ${message.channel}`
                )
            );

            await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while setting slowmode.');
        }
    },
};