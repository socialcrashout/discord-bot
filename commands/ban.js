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
const ALLOWED_ROLE_ID = '1504311819458580531,1504312910862880879'; // Replace with the role ID that can use /ban

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
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
            return errorReply('You do not have permission to ban members.');
        }

        // Role restriction
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have the required role to use this command.');
        }

        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_days') || 0;
        const member = interaction.guild.members.cache.get(target.id);

        if (member) {
            if (!member.bannable) {
                return errorReply('I cannot ban this member. They may have a higher role than me or I lack permissions.');
            }

            if (member.id === interaction.user.id) {
                return errorReply('You cannot ban yourself.');
            }
        }

        try {
            await interaction.guild.members.ban(target.id, {
                deleteMessageSeconds: deleteDays * 24 * 60 * 60,
                reason,
            });

            const caseNumber = await getNextCase(interaction.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addModLog(interaction.guild.id, {
                caseNumber,
                type: 'ban',
                userId: target.id,
                userTag: target.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                reason,
                timestamp,
            });

            // Log to mod-log channel
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1530775133713731826> Ban Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1530774414436729012> Used By:** ${interaction.user}\n` +
                        `**<:user:1530778349184618627> User Banned:** ${target.tag} (${target.id})\n` +
                        `**<:Comment:1530774457961025618> Reason:** ${reason}\n` +
                        `**<:Dot:1530774492412907721> Channel:** ${interaction.channel}\n` +
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
                    `**Member Banned** | Case #${caseNumber}\n` +
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
            await errorReply('Something went wrong while trying to ban that member.');
        }
    },
};