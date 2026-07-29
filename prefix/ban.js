const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const getNextCase = require('../utils/getNextCase');
const { addModLog } = require('../utils/modlogs');

const LOG_CHANNEL_ID = '1506450870269906944';

const ALLOWED_ROLE_IDS = [
    '1504311819458580531',
    '1504312910862880879'
];

module.exports = {
    name: 'ban',
    description: 'Ban a member from the server',

    // Usage: -ban @user reason...

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
        if (!message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
            return errorReply('You do not have the required role to use this command.');
        }

        const target = message.mentions.members?.first();

        if (!target) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please mention a member to ban. Usage: `-ban @user [reason]`'
            );
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        if (!target.bannable) {
            return errorReply(
                'I cannot ban this member. They may have a higher role than me or I lack permissions.'
            );
        }

        if (target.id === message.author.id) {
            return errorReply('You cannot ban yourself.');
        }

        try {
            await target.ban({ reason });

            const caseNumber = await getNextCase(message.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addModLog(message.guild.id, {
                caseNumber,
                type: 'ban',
                userId: target.id,
                userTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason,
                timestamp,
            });

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:ShieldCheck:1502514212168274061> Ban Command Used! | Case #${caseNumber}\n` +
                            `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                            `**<:person:1502514200705105981> User Banned:** ${target.user.tag} (${target.id})\n` +
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

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Member Banned** | Case #${caseNumber}\n` +
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
            await errorReply('Something went wrong while trying to ban that member.');
        }
    },
};