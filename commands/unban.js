const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const getNextCase = require('../utils/getNextCase');

const LOG_CHANNEL_ID = '1506450870269906944';
const ALLOWED_ROLE_ID = 'ROLE_ID_HERE'; // Replace with the role ID that can use /unban

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('The user ID to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const errorReply = (text) => interaction.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        // Permission check
        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return errorReply('You do not have permission to unban members.');
        }

        // Role restriction
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have the required role to use this command.');
        }

        const userId = interaction.options.getString('userid').trim();
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!/^\d{17,20}$/.test(userId)) {
            return errorReply(
                'That doesn\'t look like a valid user ID. Right-click the user (or find them in the ban list) and copy their ID.'
            );
        }

        try {
            // Confirm they're actually banned first
            const bans = await interaction.guild.bans.fetch();
            const banEntry = bans.get(userId);

            if (!banEntry) {
                return errorReply('That user is not currently banned.');
            }

            await interaction.guild.members.unban(userId, reason);

            const caseNumber = await getNextCase(interaction.guild.id);
            const userTag = banEntry.user.tag;

            // Log to mod-log channel
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Unban Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                        `**<:person:1502514200705105981> User Unbanned:** ${userTag} (${userId})\n` +
                        `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                        `**<:Dot:1502513706347528213> Channel:** ${interaction.channel}\n` +
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
                    `**Member Unbanned** | Case #${caseNumber}\n` +
                    `**User:** ${userTag} (${userId})\n` +
                    `**Moderator:** ${interaction.user.tag}\n` +
                    `**Reason:** ${reason}`
                )
            );

            await interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });

        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while trying to unban that user.');
        }
    },
};