const {
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const getNextCase = require('../utils/getNextCase');
const { addModLog } = require('../utils/modlogs');

const LOG_CHANNEL_ID = '1506450870269906944';
const ALLOWED_ROLE_ID = '1504311819458580531,1504313264576925757,1504312910862880879,1504320706341502996'; // Replace with the role ID that can use -kick

module.exports = {
    name: 'kick',
    description: 'Kick a member from the server',
    // Usage: -kick @user reason...

    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        // Permission check
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return errorReply('You do not have permission to kick members.');
        }

        // Role restriction
        if (!message.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have the required role to use this command.');
        }

        const target = message.mentions.members?.first();

        if (!target) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please mention a member to kick. Usage: `-kick @user [reason]`'
            );
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!target.kickable) {
            return errorReply('I cannot kick this member. They may have a higher role than me or I lack permissions.');
        }

        if (target.id === message.author.id) {
            return errorReply('You cannot kick yourself.');
        }

        try {
            await target.kick(reason);

            const caseNumber = await getNextCase(message.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addModLog(message.guild.id, {
                caseNumber,
                type: 'kick',
                userId: target.id,
                userTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason,
                timestamp,
            });

            // Log to mod-log channel
            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Kick Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                        `**<:person:1502514200705105981> User Kicked:** ${target.user.tag} (${target.id})\n` +
                        `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                        `**<:Dot:1502513706347528213> Channel:** ${message.channel}\n` +
                        `**<:Calendar:1502513561866473734> Timestamp:** <t:${timestamp}:F>`
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
                    `**Member Kicked** | Case #${caseNumber}\n` +
                    `**User:** ${target.user.tag} (${target.id})\n` +
                    `**Moderator:** ${message.author.tag}\n` +
                    `**Reason:** ${reason}`
                )
            );

            await message.channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });

        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while trying to kick that member.');
        }
    },
};