const {
    hasPermission,
    buildNoPermissionEmbed,
    buildFundsEmbed,
    fetchFundsData,
    errorMessage,
} = require('../utils/fundsHelpers');

module.exports = {
    name: 'funds',
    execute: async (message, args, client) => {
        if (!hasPermission(message.member)) {
            return message.reply({ embeds: [buildNoPermissionEmbed()] });
        }

        const loadingMsg = await message.reply('💸 Fetching group funds...');

        const groupId = process.env.GROUP_ID;
        try {
            const data = await fetchFundsData(groupId);
            await loadingMsg.edit({ content: null, embeds: [buildFundsEmbed(data)] });
        } catch (err) {
            await loadingMsg.edit({ content: errorMessage(err) });
        }
    },
};