const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const { getWarningsForUser } = require('../utils/warnings');

module.exports = {
    name: 'warns',
    description: 'View all warnings a member has',
    // Usage: -warns @user
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('<:WarningIcon:1508245066135765034> You do not have permission to view warnings.');
        }

        const target = message.mentions.users?.first();
        if (!target) return errorReply('<:WarningIcon:1508245066135765034> Please mention a member. Usage: `-warns @user`');

        const warnings = getWarningsForUser(message.guild.id, target.id);

        if (warnings.length === 0) {
            return message.channel.send({
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**${target.tag}** has no warnings.`)
                )],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## <:ShieldCheck:1502514212168274061> Warnings for ${target.tag}\n` +
                `-# **<:person:1502514200705105981> Total Warnings:** ${warnings.length}`
            )
        );

        const sorted = [...warnings].sort((a, b) => b.timestamp - a.timestamp);

        sorted.forEach((warning) => {
            container.addSeparatorComponents(new SeparatorBuilder());
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**<:Dot:1502513706347528213> Case #${warning.caseNumber}**\n` +
                    `**<:sig:1502514350014070795> Moderator:** ${warning.moderatorTag}\n` +
                    `**<:Comment:1502512880493400196> Reason:** ${warning.reason}\n` +
                    `**<:Calendar:1502513561866473734> Date:** <t:${warning.timestamp}:F>`
                )
            );
        });

        await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};