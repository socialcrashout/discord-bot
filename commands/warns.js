const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');

const { getWarningsForUser } = require('../utils/warnings');

const ALLOWED_ROLE_IDS = [
    '1504320706341502996',
    '1504313264576925757',
    '1504312910862880879',
    '1504311819458580531'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warns')
        .setDescription('View all warnings a member has')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to check')
                .setRequired(true)
        ),

    async execute(interaction) {

        const errorReply = (text) => interaction.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        // Role restriction
        if (!ALLOWED_ROLE_IDS.some(role => interaction.member.roles.cache.has(role))) {
            return errorReply('You do not have the required role to use this command.');
        }

        const target = interaction.options.getUser('target');

        const warnings = getWarningsForUser(
            interaction.guild.id,
            target.id
        );

        if (warnings.length === 0) {
            return interaction.reply({
                components: [
                    new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**${target.tag}** has no warnings.`
                        )
                    )
                ],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1530775133713731826> Warnings for ${target.tag}\n` +
                    `-# **<:user:1530778349184618627> Total Warnings:** ${warnings.length}`
                )
            );

        const sorted = [...warnings].sort(
            (a, b) => b.timestamp - a.timestamp
        );

        sorted.forEach((warning) => {
            container.addSeparatorComponents(new SeparatorBuilder());

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**<:Dot:1530774492412907721> Case #${warning.caseNumber}**\n` +
                    `**<:sig:1530774414436729012> Moderator:** ${warning.moderatorTag}\n` +
                    `**<:Comment:1530774457961025618> Reason:** ${warning.reason}\n` +
                    `**<:Calendar:1530778367966843010> Date:** <t:${warning.timestamp}:F>`
                )
            );
        });

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
    },
};