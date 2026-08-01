const { MessageFlags } = require('discord.js');

const {
    hasPermission,
    buildNoPermissionContainer,
    buildFundsContainer,
    fetchFundsData,
    errorMessage,
} = require('../utils/fundsHelpers');

const ALLOWED_ROLE_IDS = [
    '1504311819458580531'
];

module.exports = {
    name: 'funds',

    execute: async (message, args, client) => {

        // Permission check
        if (!message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
            return message.reply({
                components: [
                    buildNoPermissionContainer('You do not have the required role to use this command.')
                ],
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
            console.error('[-funds] Error:', err);
            await loadingMsg.edit({
                content: errorMessage(err),
            });
        }
    },
};