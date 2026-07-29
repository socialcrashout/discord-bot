const { MessageFlags } = require('discord.js');

const {
    hasPermission,
    buildNoPermissionContainer,
    buildFundsContainer,
    fetchFundsData,
    errorMessage,
} = require('../utils/fundsHelpers');

const ALLOWED_ROLE_ID = 'ROLE_ID_HERE'; // Replace with the role ID that can use -funds

module.exports = {
    name: 'funds',

    execute: async (message, args, client) => {

        // Permission check
        if (!hasPermission(message.member)) {
            return message.reply({
                components: [buildNoPermissionContainer()],
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // Role restriction
        if (!message.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return message.reply({
                components: [buildNoPermissionContainer('You do not have the required role to use this command.')],
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
            await loadingMsg.edit({
                content: errorMessage(err),
            });
        }
    },
};