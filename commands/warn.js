const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const getNextCase = require('../utils/getNextCase');
const { addWarning } = require('../utils/warnings');

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const errorReply = (text) => interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('You do not have permission to warn members.');
        }

        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');

        try {
            const caseNumber = await getNextCase(interaction.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addWarning(interaction.guild.id, {
                caseNumber,
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
                        `## <:ShieldCheck:1530775133713731826> Warn Command Used! | Case #${caseNumber}\n` +
                        `-# **<:sig:1530774414436729012> Used By:** ${interaction.user}\n` +
                        `**<:user:1530778349184618627> User Warned:** ${target.tag} (${target.id})\n` +
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
                    `**Member Warned** | Case #${caseNumber}\n` +
                    `**User:** ${target.tag} (${target.id})\n` +
                    `**Moderator:** ${interaction.user.tag}\n` +
                    `**Reason:** ${reason}`
                )
            );

            await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while warning that member.');
        }
    },
};