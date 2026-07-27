const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags, ChannelType } = require('discord.js');

const LOG_CHANNEL_ID = '1529922818253390018';

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
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set slowmode for a channel')
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration, e.g. 10s, 5m, 1h (max 6h). Use 0 to disable.')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to apply slowmode to (defaults to this channel)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const errorReply = (text) => interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return errorReply('You do not have permission to manage channels.');
        }

        const durationInput = interaction.options.getString('duration');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        let seconds;
        if (durationInput.trim() === '0') {
            seconds = 0;
        } else {
            seconds = parseDuration(durationInput);
            if (seconds === null) return errorReply('Invalid duration. Use a format like `10s`, `5m`, `1h` (max 6h), or `0` to disable.');
        }

        try {
            await channel.setRateLimitPerUser(seconds);

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1530775133713731826> Slowmode Command Used!\n` +
                        `-# **<:sig:1530774414436729012> Used By:** ${interaction.user}\n` +
                        `**<:user:1530778349184618627> Slowmode Set:** ${seconds === 0 ? 'Disabled' : `${seconds}s`}\n` +
                        `**<:Dot:1530774492412907721> Channel:** ${channel}\n` +
                        `**<:Calendar:1530778367966843010> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
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
                        ? `**Slowmode disabled** in ${channel}`
                        : `**Slowmode set to ${seconds}s** in ${channel}`
                )
            );

            await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while setting slowmode.');
        }
    },
};