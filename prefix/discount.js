const { TextDisplayBuilder, ContainerBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: 'discount',
    aliases: [],
    description: 'Calculate a discounted price.',
    async execute(message, args, client) {
        const amount = parseInt(args[0]);
        const percent = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0 || isNaN(percent) || percent < 1 || percent > 99) {
            return message.reply('Usage: `-discount <amount> <percent>`');
        }

        try {
            const savings = Math.floor(amount * (percent / 100));
            const discounted = amount - savings;

            const components = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <1517896127272194188 Discount Calculator\n**Original price:** ${amount}  •  **Discount:** ${percent}% (-${savings})  •  **Discounted price:** ${discounted}`
                        ),
                    ),
            ];
            await message.reply({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error('Error in -discount:', error);
            const components = [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent("<:CrossS:1485912571054915675> An error has occured. Please try again.\n```" + error.message + "```"),
                    ),
            ];
            await message.reply({ components, flags: MessageFlags.IsComponentsV2 });
        }
    }
};