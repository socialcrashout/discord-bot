const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { removeWarningByCase } = require('../utils/warnings');

const LOG_CHANNEL_ID = '1529922818253390018';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clearwarn')
        .setDescription('Remove a specific warning by its case number')
        .addIntegerOption(option =>
            option.setName('case')
                .setDescription('The case number of the warning to remove')
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
            return errorReply('You do not have permission to clear warnings.');
        }

        const caseNumber = interaction.options.getInteger('case');
        const removed = removeWarningByCase(interaction.guild.id, caseNumber);

        if (!removed) {
            return errorReply(`No warning found with Case #${caseNumber}.`);
        }

        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1530775133713731826> Clearwarn Command Used!\n` +
                    `-# **<:sig:1530774414436729012> Used By:** ${interaction.user}\n` +
                    `**<:user:1530778349184618627> Warning Removed:** Case #${caseNumber} (was ${removed.userTag})\n` +
                    `**<:Comment:1530774457961025618> Original Reason:** ${removed.reason}\n` +
                    `**<:Dot:1530774492412907721> Channel:** ${interaction.channel}\n` +
                    `**<:Calendar:1530778367966843010> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
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
                `**Warning Cleared**\n` +
                `**Case #:** ${caseNumber}\n` +
                `**User:** ${removed.userTag}\n` +
                `**Original Reason:** ${removed.reason}`
            )
        );

        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};