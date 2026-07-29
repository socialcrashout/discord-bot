const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const { getLogsForUser } = require('../utils/modlogs');

const ALLOWED_ROLE_ID = '1504311819458580531,1504313264576925757,1504312910862880879,1504320706341502996'; // Replace with the role ID that can use /modlogs

const TYPE_LABELS = {
    warn: 'Warn',
    kick: 'Kick',
    ban: 'Ban',
    timeout: 'Timeout',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription("View a member's moderation history")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The member to look up')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

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
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('You do not have permission to view moderation logs.');
        }

        // Role restriction
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have the required role to use this command.');
        }

        const target = interaction.options.getUser('user');
        const logs = getLogsForUser(interaction.guild.id, target.id);

        if (logs.length === 0) {
            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1502514212168274061> Mod Logs | ${target.tag}\n` +
                    `This user has a clean record — no cases on file.`
                )
            );

            return interaction.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const shown = logs.slice(0, 10);

        const lines = shown.map(log =>
            `**Case #${log.caseNumber} — ${TYPE_LABELS[log.type] || log.type}**\n` +
            `> **Moderator:** ${log.moderatorTag}\n` +
            (log.duration ? `> **Duration:** ${log.duration}\n` : '') +
            `> **Reason:** ${log.reason || 'No reason provided'}\n` +
            `> **Date:** <t:${log.timestamp}:F>`
        ).join('\n\n');

        const footer = logs.length > shown.length
            ? `\n\n-# Showing ${shown.length} of ${logs.length} total cases.`
            : `\n\n-# ${logs.length} total case${logs.length === 1 ? '' : 's'}.`;

        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## <:ShieldCheck:1502514212168274061> Mod Logs | ${target.tag} (${target.id})\n\n` +
                lines +
                footer
            )
        );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};