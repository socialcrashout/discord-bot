const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLockState, clearLockState } = require('../utils/serverLock');

const LOG_CHANNEL_ID = '1506450870269906944';

const ALLOWED_ROLE_IDS = [
    '1504311819458580531'
];

module.exports = {
    name: 'serverunlock',
    description: 'Unlock every text channel that was locked by -serverslock',
    // Usage: -serverunlock reason...
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

        const lockState = getLockState(message.guild.id);

        if (!lockState) {
            return errorReply('<:WarningIcon:1508245066135765034> The server is not currently locked.');
        }

        const reason = args.join(' ') || 'No reason provided';

        const everyoneRole = message.guild.roles.everyone;
        let unlockedCount = 0;

        for (const [channelId, previousValue] of Object.entries(lockState)) {
            const channel = message.guild.channels.cache.get(channelId);
            if (!channel) continue;

            try {
                await channel.permissionOverwrites.edit(
                    everyoneRole,
                    { SendMessages: previousValue },
                    { reason }
                );

                unlockedCount++;
            } catch (err) {
                console.error(`Failed to unlock channel ${channelId}:`, err);
            }
        }

        clearLockState(message.guild.id);

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

        if (logChannel) {
            const logContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Serverunlock Command Used!\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
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

        await message.channel.send('🔓');
    },
};