const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { removeWarningByCase } = require('../utils/warnings');

const LOG_CHANNEL_ID = '1506450870269906944';

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
                    `## <:ShieldCheck:1502514212168274061> Clearwarn Command Used!\n` +
                    `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                    `**<:person:1502514200705105981> Warning Removed:** Case #${caseNumber} (was ${removed.userTag})\n` +
                    `**<:Comment:1502512880493400196> Original Reason:** ${removed.reason}\n` +
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
                `**Warning Cleared**\n` +
                `**Case #:** ${caseNumber}\n` +
                `**User:** ${removed.userTag}\n` +
                `**Original Reason:** ${removed.reason}`
            )
        );

        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};