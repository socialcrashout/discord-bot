const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const { saveLock, getLock } = require('../utils/channelLock');

const LOG_CHANNEL_ID = '1506450870269906944';
const ALLOWED_ROLE_ID = 'ROLE_ID_HERE'; // Replace with the role ID that can use /slock

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slock')
        .setDescription('Lock the channel this command is run in')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the lock')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const errorReply = (text) => interaction.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        // Permission check
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return errorReply('You do not have permission to manage channels.');
        }

        // Role restriction
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have the required role to use this command.');
        }

        const channel = interaction.channel;

        if (getLock(channel.id) !== undefined) {
            return errorReply('This channel is already locked. Use `/unslock` first.');
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';
        const everyoneRole = interaction.guild.roles.everyone;

        try {
            const currentOverwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);

            const previousValue = currentOverwrite
                ? (
                    currentOverwrite.deny.has(PermissionFlagsBits.SendMessages)
                        ? false
                        : (
                            currentOverwrite.allow.has(PermissionFlagsBits.SendMessages)
                                ? true
                                : null
                        )
                )
                : null;

            saveLock(channel.id, previousValue);

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: false },
                { reason }
            );

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Slock Command Used!\n` +
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
                content: '🔒',
            });

        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while locking this channel.');
        }
    },
};