const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tax')
        .setDescription('Roblox tax')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The input amount')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        const inputAmount = interaction.options.getInteger('amount');

        if (inputAmount < 0) {
            return interaction.reply({ content: 'Please provide a valid positive number.', ephemeral: true });
        }

        const tax = Math.round(inputAmount * 0.3);
        const calculatedAmount = inputAmount - tax;
        const toReceiveExact = Math.ceil(inputAmount / 0.7);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## Tax Calculator')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `- **Input Amount:** ${inputAmount.toLocaleString()}R\n` +
                    `- **Tax (30%):** ${tax.toLocaleString()}R\n` +
                    `- **Calculated Amount:** ${calculatedAmount.toLocaleString()}R`
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `To receive exactly **${inputAmount.toLocaleString()}R**, the amount must be **${toReceiveExact.toLocaleString()}R**.`
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};