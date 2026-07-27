const { SlashCommandBuilder, TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('discount')
        .setDescription('Calculate a discounted price.')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Original Amount')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('percent')
                .setDescription('Discount Percentage (e.g. 10 for 10%)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1000000000000)
        ),
    async execute(interaction) {
        try {
            const amount = interaction.options.getInteger('amount');
            const percent = interaction.options.getInteger('percent');
            const savings = Math.floor(amount * (percent / 100));
            const discounted = amount - savings;

            const components = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:Roblox:1485911964625404014> Discount Calculator\n**Original price:** ${amount}  •  **Discount:** ${percent}% (-${savings})  •  **Discounted price:** ${discounted}`
                        ),
                    ),
            ];

            await interaction.reply({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error('Error in /discount:', error);
            const components = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("<:CrossS:1485912571054915675> An error has occured. Please try again.\n```" + error.message + "```"),
                    ),
            ];
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ components, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ components, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }
        }
    }
};