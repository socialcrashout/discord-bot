const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLockState, clearLockState } = require('../utils/serverLock');

const LOG_CHANNEL_ID = '15064508702699069448';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverunlock')
        .setDescription('Unlock every text channel that was locked by /serverslock')
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the server unlock')
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

        const lockState = getLockState(interaction.guild.id);
        if (!lockState) {
            return errorReply('The server is not currently locked.');
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const everyoneRole = interaction.guild.roles.everyone;
        let unlockedCount = 0;

        for (const [channelId, previousValue] of Object.entries(lockState)) {
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) continue;

            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: previousValue }, { reason });
                unlockedCount++;
            } catch (err) {
                console.error(`Failed to unlock channel ${channelId}:`, err);
            }
        }

        clearLockState(interaction.guild.id);

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1502514212168274061> Serverunlock Command Used!\n` +
                    `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                    `**<:person:1502514200705105981> Channels Unlocked:** ${unlockedCount}\n` +
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

        await interaction.editReply({ content: `🔓` });
    },
};