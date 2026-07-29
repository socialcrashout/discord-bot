const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
    ChannelType,
} = require('discord.js');

const { saveLockState, getLockState } = require('../utils/serverLock');

const LOG_CHANNEL_ID = '1506450870269906944';
const ALLOWED_ROLE_ID = '1504311819458580531'; // Replace with the role ID that can use /serverslock

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverslock')
        .setDescription('Lock every text channel in the server')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the server lock')
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

        if (getLockState(interaction.guild.id)) {
            return errorReply('The server is already locked. Use `/serverunlock` first.');
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        const everyoneRole = interaction.guild.roles.everyone;
        const textChannels = interaction.guild.channels.cache.filter(
            ch => ch.type === ChannelType.GuildText
        );

        const channelStates = {};
        let lockedCount = 0;

        for (const channel of textChannels.values()) {
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

                channelStates[channel.id] = previousValue;

                await channel.permissionOverwrites.edit(
                    everyoneRole,
                    { SendMessages: false },
                    { reason }
                );

                lockedCount++;
            } catch (err) {
                console.error(`Failed to lock channel ${channel.id}:`, err);
            }
        }

        saveLockState(interaction.guild.id, channelStates);

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

        if (logChannel) {
            const logContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1502514212168274061> Serverslock Command Used!\n` +
                    `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                    `**<:person:1502514200705105981> Channels Locked:** ${lockedCount}\n` +
                    `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                    `**<:Calendar:1502513561866473734> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                )
            );

            await logChannel.send({
                components: [logContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            });
        }

        await interaction.editReply({
            content: '🔒',
        });
    },
};