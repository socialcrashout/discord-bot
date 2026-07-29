const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const getNextCase = require('../utils/getNextCase');
const { addModLog } = require('../utils/modlogs');

const LOG_CHANNEL_ID = '1506450870269906944';

const ALLOWED_ROLE_IDS = [
    '1504311819458580531',
    '1504313264576925757',
    '1504312910862880879',
    '1504320706341502996'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

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
        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return errorReply('You do not have permission to kick members.');
        }

        // Role restriction
        if (!interaction.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
            return errorReply('You do not have the required role to use this command.');
        }

        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);

        if (!member) {
            return errorReply('That user is not in this server.');
        }

        if (!member.kickable) {
            return errorReply('I cannot kick this member. They may have a higher role than me or I lack permissions.');
        }

        if (member.id === interaction.user.id) {
            return errorReply('You cannot kick yourself.');
        }

        try {
            await member.kick(reason);

            const caseNumber = await getNextCase(interaction.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addModLog(interaction.guild.id, {
                caseNumber,
                type: 'kick',
                userId: target.id,
                userTag: target.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
                timestamp,
            });

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Kick Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                        `**<:person:1502514200705105981> User Kicked:** ${target.tag} (${target.id})\n` +
                        `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                        `**<:Dot:1502513706347528213> Channel:** ${interaction.channel}\n` +
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
                    `**User:** ${target.tag} (${target.id})\n` +
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
            await errorReply('Something went wrong while trying to kick that member.');
        }
    },
};