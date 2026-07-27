const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tax')
        .setDescription('Roblox tax')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The after-tax amount')
                .setRequired(true)
        ),
    async execute(interaction, client) {
        const afterTax = interaction.options.getInteger('amount');

        if (afterTax < 0) {
            return interaction.reply({ content: 'Please provide a valid positive number.', ephemeral: true });
        }

        const beforeTax = Math.ceil(afterTax / 0.7);
        const tax = beforeTax - afterTax;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## Tax')
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Before Tax:** \`${beforeTax.toLocaleString()}\`  •  **Taxed:** \`${tax.toLocaleString()}\`  •  **After Tax:** \`${afterTax.toLocaleString()}\``
                )
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(item =>
                    item.setURL('https://media.discordapp.net/attachments/1502518130616963166/1518310251361730672/22_20260510_032209_0020.png?ex=6a64f59c&is=6a63a41c&hm=f5f520ab7c44832f06124a04969e94f08a8c0d03feee9c18d583935b7f830fad&=&format=webp&quality=lossless&width=2704&height=202')
                )
            );

        await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};