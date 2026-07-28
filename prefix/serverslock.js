const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags, ChannelType } = require('discord.js');
const { saveLockState, getLockState } = require('../utils/serverLock');

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    name: 'serverslock',
    description: 'Lock every text channel in the server',
    // Usage: -serverslock reason...
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

        if (getLockState(message.guild.id)) {
            return errorReply('The server is already locked. Use `-serverunlock` first.');
        }

        const reason = args.join(' ') || 'No reason provided';

        const everyoneRole = message.guild.roles.everyone;
        const textChannels = message.guild.channels.cache.filter(
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

        saveLockState(message.guild.id, channelStates);

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1502514212168274061> Serverslock Command Used!\n` +
                    `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
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

        await message.channel.send(`🔒`);
    },
};