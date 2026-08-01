const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const { getLock, clearLock } = require('../utils/channellLock');

const LOG_CHANNEL_ID = '1506450870269906944';

const ALLOWED_ROLE_IDS = [
    '1504311819458580531',
    '1504313264576925757',
    '1504312910862880879'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unslock')
        .setDescription('Unlock the channel this command is run in')
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the unlock')
                .setRequired(false)
        ),

    async execute(interaction) {

        const errorReply = (text) => interaction.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        // Role restriction
        if (!ALLOWED_ROLE_IDS.some(role => interaction.member.roles.cache.has(role))) {
            return errorReply('You do not have the required role to use this command.');
        }

        const channel = interaction.channel;
        const previousValue = getLock(channel.id);

        if (previousValue === undefined) {
            return errorReply('This channel is not currently locked.');
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: previousValue },
                { reason }
            );

            clearLock(channel.id);

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:ShieldCheck:1502514212168274061> Unslock Command Used!\n` +
                            `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                            `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                            `**<:Dot:1502513706347528213> Channel:** ${channel}\n` +
                            `**<:Calendar:1502513561866473734> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        )
                    );

                await logChannel.send({
                    components: [logContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                });
            }

            await interaction.reply({
                content: '🔓',
            });

        } catch (error) {
            console.error(error);

            await errorReply(
                'Something went wrong while unlocking this channel.'
            );
        }
    },
};