const {
    SlashCommandBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("donate")
        .setDescription("Support the server with a donation!"),

    async execute(interaction) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    "# 💝 Donate\nThank you for wanting to support us! Choose how you'd like to donate below."
                )
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId("donate_method_select")
                        .setPlaceholder("Choose a donation method")
                        .addOptions(
                            {
                                label: "USD (Ko-fi / Cashapp)",
                                value: "usd",
                                emoji: "💵",
                            },
                            {
                                label: "Robux",
                                value: "robux",
                                emoji: "🎮",
                            }
                        )
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
    },
};