const { MessageFlags } = require('discord.js');
const {
    hasPermission,
    buildNoPermissionContainer,
    buildFundsContainer,
    fetchFundsData,
    errorMessage,
} = require('../utils/fundsHelpers');

module.exports = {
    name: 'funds',
    execute: async (message, args, client) => {
        if (!hasPermission(message.member)) {
            return message.reply({
                components: [buildNoPermissionContainer()],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        const loadingMsg = await message.reply('💸 Fetching group funds...');

        const groupId = process.env.GROUP_ID;
        try {
            const data = await fetchFundsData(groupId);
            await loadingMsg.edit({
                content: null,
                components: [buildFundsContainer(data)],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (err) {
            await loadingMsg.edit({ content: errorMessage(err) });
        }
    },
};