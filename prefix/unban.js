const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const getNextCase = require('../utils/getNextCase');

const ALLOWED_ROLE_ID = '1504311819458580531,1504312910862880879';
const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    name: 'unban',
    description: 'Unban a user from the server',

    // Usage: -unban <userId> reason...
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
        if (!message.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have permission to use this command.');
        }

        const rawId = args[0]?.replace(/[<@!>]/g, '');

        if (!rawId || !/^\d{17,20}$/.test(rawId)) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please provide a valid user ID. Usage: `-unban <userId> [reason]`'
            );
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        try {
            const bans = await message.guild.bans.fetch();
            const banEntry = bans.get(rawId);

            if (!banEntry) {
                return errorReply('That user is not currently banned.');
            }

            await message.guild.members.unban(rawId, reason);

            const caseNumber = await getNextCase(message.guild.id);
            const userTag = banEntry.user.tag;

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:ShieldCheck:1502514212168274061> Unban Command Used! | Case #${caseNumber}\n` +
                            `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                            `**<:person:1502514200705105981> User Unbanned:** ${userTag} (${rawId})\n` +
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

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**Member Unbanned** | Case #${caseNumber}\n` +
                        `**User:** ${userTag} (${rawId})\n` +
                        `**Moderator:** ${message.author.tag}\n` +
                        `**Reason:** ${reason}`
                    )
                );

            await message.channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while trying to unban that user.');
        }
    },
};