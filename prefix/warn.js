const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const getNextCase = require('../utils/getNextCase');
const { addWarning } = require('../utils/warnings');

const LOG_CHANNEL_ID = '1529922818253390018';

module.exports = {
    name: 'warn',
    description: 'Warn a member',
    // Usage: -warn @user reason...
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('<:warning:1531049700520624278> You do not have permission to warn members.');
        }

        const target = message.mentions.members?.first();
        if (!target) return errorReply('<:warning:1531049700520624278> Please mention a member to warn. Usage: `-warn @user [reason]`');

        const reason = args.slice(1).join(' ');
        if (!reason) return errorReply('<:warning:1531049700520624278> Please provide a reason. Usage: `-warn @user [reason]`');

        try {
            const caseNumber = await getNextCase(message.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addWarning(message.guild.id, {
                caseNumber,
                userId: target.id,
                userTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason,
                timestamp,
            });

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1530775133713731826> Warn Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1530774414436729012> Used By:** ${message.author}\n` +
                        `**<:user:1530778349184618627> User Warned:** ${target.user.tag} (${target.id})\n` +
                        `**<:Comment:1530774457961025618> Reason:** ${reason}\n` +
                        `**<:Dot:1530774492412907721> Channel:** ${message.channel}\n` +
                        `**<:Calendar:1530778367966843010> Timestamp:** <t:${timestamp}:F>`
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
                    `**Member Warned** | Case #${caseNumber}\n` +
                    `**User:** ${target.user.tag} (${target.id})\n` +
                    `**Moderator:** ${message.author.tag}\n` +
                    `**Reason:** ${reason}`
                )
            );

            await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while warning that member.');
        }
    },
};