const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const getNextCase = require('../utils/getNextCase');

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    name: 'ban',
    description: 'Ban a member from the server',
    // Usage: -ban @user reason...
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return errorReply('You do not have permission to ban members.');
        }

        const target = message.mentions.members?.first();
        if (!target) return errorReply('<:WarningIcon:1508245066135765034> Please mention a member to ban. Usage: `-ban @user [reason]`');

        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!target.bannable) return errorReply('I cannot ban this member. They may have a higher role than me or I lack permissions.');
        if (target.id === message.author.id) return errorReply('You cannot ban yourself.');

        try {
            await target.ban({ reason });

            const caseNumber = await getNextCase(message.guild.id);

            // Log to mod-log channel
            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Ban Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                        `**<:user:1530778349184618627> User Banned:** ${target.user.tag} (${target.id})\n` +
                        `**<:Comment:1530774457961025618> Reason:** ${reason}\n` +
                        `**<:Dot:1530774492412907721> Channel:** ${message.channel}\n` +
                        `**<:Calendar:1530778367966843010> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
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
                    `**Member Banned** | Case #${caseNumber}\n` +
                    `**User:** ${target.user.tag} (${target.id})\n` +
                    `**Moderator:** ${message.author.tag}\n` +
                    `**Reason:** ${reason}`
                )
            );

            await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while trying to ban that member.');
        }
    },
};