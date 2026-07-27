const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLockState, clearLockState } = require('../utils/serverLock');

const LOG_CHANNEL_ID = '1529922818253390018';

module.exports = {
    name: 'serverunlock',
    description: 'Unlock every text channel that was locked by -serverslock',
    // Usage: -serverunlock reason...
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

        const lockState = getLockState(message.guild.id);
        if (!lockState) {
            return errorReply('The server is not currently locked.');
        }

        const reason = args.join(' ') || 'No reason provided';

        const everyoneRole = message.guild.roles.everyone;
        let unlockedCount = 0;

        for (const [channelId, previousValue] of Object.entries(lockState)) {
            const channel = message.guild.channels.cache.get(channelId);
            if (!channel) continue;

            try {
                await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: previousValue }, { reason });
                unlockedCount++;
            } catch (err) {
                console.error(`Failed to unlock channel ${channelId}:`, err);
            }
        }

        clearLockState(message.guild.id);

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1530775133713731826> Serverunlock Command Used!\n` +
                    `-# **<:sig:1530774414436729012> Used By:** ${message.author}\n` +
                    `**<:user:1530778349184618627> Channels Unlocked:** ${unlockedCount}\n` +
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

        await message.channel.send(`🔓`);
    },
};