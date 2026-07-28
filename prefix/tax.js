const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: 'tax',
    description: 'Calculate tax on an amount',
    // Usage: -tax <amount>
    async execute(message, args) {
        const inputAmount = parseInt(args[0], 10);

        if (isNaN(inputAmount) || inputAmount < 0) {
            return message.reply('Please provide a valid positive number. Usage: `-tax <amount>`');
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

        await message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};