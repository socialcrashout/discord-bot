const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { getLogsForUser } = require('../utils/modlogs');

const TYPE_LABELS = {
    warn: 'Warn',
    kick: 'Kick',
    ban: 'Ban',
    timeout: 'Timeout',
};

module.exports = {
    name: 'modlogs',
    description: "View a member's moderation history",
    // Usage: -modlogs @user
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('<:warning:1531049700520624278> You do not have permission to view mod logs.');
        }

        const target = message.mentions.members?.first();
        if (!target) return errorReply('<:WarningIcon:1508245066135765034> Please mention a member. Usage: `-modlogs @user`');

        const logs = getLogsForUser(message.guild.id, target.id);

        if (logs.length === 0) {
            const container = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1502514212168274061> Mod Logs | ${target.user.tag}\n` +
                    `This user has a clean record — no cases on file.`
                )
            );
            return message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
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
                `## <:ShieldCheck:1502514212168274061> Mod Logs | ${target.user.tag} (${target.id})\n\n` +
                lines +
                footer
            )
        );

        await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};