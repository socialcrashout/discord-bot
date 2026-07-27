const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags, ChannelType } = require('discord.js');
const { saveLockState, getLockState } = require('../utils/serverLock');

const LOG_CHANNEL_ID = '1529922818253390018';

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
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return errorReply('You do not have permission to manage channels.');
        }

        if (getLockState(interaction.guild.id)) {
            return errorReply('The server is already locked. Use `/serverunlock` first.');
        }

        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
                    ? (currentOverwrite.deny.has(PermissionFlagsBits.SendMessages)
                        ? false
                        : (currentOverwrite.allow.has(PermissionFlagsBits.SendMessages) ? true : null))
                    : null;

                channelStates[channel.id] = previousValue;

                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }, { reason });
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
                    `## <:ShieldCheck:1530775133713731826> Serverslock Command Used!\n` +
                    `-# **<:sig:1530774414436729012> Used By:** ${interaction.user}\n` +
                    `**<:user:1530778349184618627> Channels Locked:** ${lockedCount}\n` +
                    `**<:Comment:1530774457961025618> Reason:** ${reason}\n` +
                    `**<:Calendar:1530778367966843010> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                )
            );

            await logChannel.send({
                components: [logContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            });
        }

        await interaction.editReply({ content: `🔒` });
    },
};