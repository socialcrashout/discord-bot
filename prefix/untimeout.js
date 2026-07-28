const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const getNextCase = require('../utils/getNextCase');

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    name: 'untimeout',
    description: 'Remove an active timeout from a member',
    // Usage: -untimeout @user reason...
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('You do not have permission to remove timeouts.');
        }

        const target = message.mentions.members?.first();
        if (!target) return errorReply('<:WarningIcon:1508245066135765034> Please mention a member. Usage: `-untimeout @user [reason]`');

        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!target.moderatable) return errorReply('I cannot modify this member. They may have a higher role than me or I lack permissions.');
        if (!target.communicationDisabledUntilTimestamp || target.communicationDisabledUntilTimestamp < Date.now()) {
            return errorReply('That member is not currently timed out.');
        }

        try {
            await target.timeout(null, reason);

            const caseNumber = await getNextCase(message.guild.id);

            // Log to mod-log channel
            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Untimeout Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                        `**<:person:1502514200705105981> User Untimed Out:** ${target.user.tag} (${target.id})\n` +
                        `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                        `**<:Dot:1502513706347528213> Channel:** ${message.channel}\n` +
                        `**<:Calendar:1502513561866473734> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    )
                );

                await logChannel.send({
                    components: [logContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                });
            }

            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Member Untimed Out** | Case #${caseNumber}\n` +
                    `**User:** ${target.user.tag} (${target.id})\n` +
                    `**Moderator:** ${message.author.tag}\n` +
                    `**Reason:** ${reason}`
                )
            );

            await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while trying to remove that timeout.');
        }
    },
};