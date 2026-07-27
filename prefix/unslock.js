const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLock, clearLock } = require('../utils/channelLock');

const LOG_CHANNEL_ID = '1529922818253390018';

module.exports = {
    name: 'unslock',
    description: 'Unlock the channel this command is run in',
    // Usage: -unslock reason...
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

        const channel = message.channel;
        const previousValue = getLock(channel.id);

        if (previousValue === undefined) {
            return errorReply('This channel is not currently locked.');
        }

        const reason = args.join(' ') || 'No reason provided';
        const everyoneRole = message.guild.roles.everyone;

        try {
            await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: previousValue }, { reason });
            clearLock(channel.id);

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1530775133713731826> Unslock Command Used!\n` +
                        `-# **<:sig:1530774414436729012> Used By:** ${message.author}\n` +
                        `**<:Comment:1530774457961025618> Reason:** ${reason}\n` +
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

            await message.channel.send('🔓');
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while unlocking this channel.');
        }
    },
};