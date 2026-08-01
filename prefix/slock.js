const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { saveLock, getLock } = require('../utils/channelLock');

const LOG_CHANNEL_ID = '1506450870269906944';

const ALLOWED_ROLE_IDS = [
    '1504311819458580531',
    '1504313264576925757',
    '1504312910862880879'
];

module.exports = {
    name: 'slock',
    description: 'Lock the channel this command is run in',
    // Usage: -slock reason...
    async execute(message, args) {

        const errorReply = (text) => message.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        // Role restriction
        const hasRole = ALLOWED_ROLE_IDS.some(roleId =>
            message.member.roles.cache.has(roleId)
        );

        if (!hasRole) {
            return errorReply('You do not have permission to use this command.');
        }

        const channel = message.channel;

        if (getLock(channel.id) !== undefined) {
            return errorReply('<:WarningIcon:1508245066135765034> This channel is already locked. Use `-unslock` first.');
        }

        const reason = args.join(' ') || 'No reason provided';
        const everyoneRole = message.guild.roles.everyone;

        try {
            const currentOverwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);

            const previousValue = currentOverwrite
                ? (currentOverwrite.deny.has('SendMessages')
                    ? false
                    : (currentOverwrite.allow.has('SendMessages') ? true : null))
                : null;

            saveLock(channel.id, previousValue);

            await channel.permissionOverwrites.edit(
                everyoneRole,
                { SendMessages: false },
                { reason }
            );

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:ShieldCheck:1502514212168274061> Slock Command Used!\n` +
                            `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
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

            await message.channel.send('🔒');

        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while locking this channel.');
        }
    },
};