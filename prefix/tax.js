const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MediaGalleryBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: 'tax',
    aliases: [],
    description: 'Roblox tax',
    async execute(message, args, client) {
        if (!args[0] || isNaN(args[0])) return message.reply('Please provide a valid number.');

        const afterTax = parseInt(args[0]);
        const beforeTax = Math.ceil(afterTax / 0.7);
        const tax = beforeTax - afterTax;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## <:money:1502514540687003668> | Tax')
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

        await message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });
    }
};