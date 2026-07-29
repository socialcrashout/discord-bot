const {
    SlashCommandBuilder,
    MessageFlags,
} = require('discord.js');

const {
    hasPermission,
    buildNoPermissionContainer,
    buildFundsContainer,
    fetchFundsData,
    errorMessage,
} = require('../utils/fundsHelpers');

const ALLOWED_ROLE_ID = 'ROLE_ID_HERE'; // Replace with the role ID that can use /funds

module.exports = {
    data: new SlashCommandBuilder()
        .setName('funds')
        .setDescription('Check Roblox group funds and pending revenue.'),

    execute: async (interaction, client) => {
        // Existing permission check
        if (!hasPermission(interaction.member)) {
            return interaction.reply({
                components: [buildNoPermissionContainer()],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
        }

        // Role restriction
        if (!interaction.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return interaction.reply({
                content: 'You do not have the required role to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        await interaction.reply({
            content: '💸 Fetching group funds...',
            ephemeral: true,
        });

        const groupId = process.env.GROUP_ID;

        try {
            const data = await fetchFundsData(groupId);

            await interaction.editReply({
                content: null,
                components: [buildFundsContainer(data)],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
        } catch (err) {
            await interaction.editReply({
                content: errorMessage(err),
            });
        }
    },
};