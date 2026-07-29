const { SlashCommandBuilder } = require('discord.js');
const {
    hasPermission,
    buildNoPermissionEmbed,
    buildFundsEmbed,
    fetchFundsData,
    errorMessage,
} = require('../utils/fundsHelpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('funds')
        .setDescription('Check Roblox group funds and pending revenue.'),

    execute: async (interaction, client) => {
        if (!hasPermission(interaction.member)) {
            return interaction.reply({ embeds: [buildNoPermissionEmbed()], ephemeral: true });
        }

        await interaction.reply({ content: '💸 Fetching group funds...', ephemeral: true });

        const groupId = process.env.GROUP_ID;
        try {
            const data = await fetchFundsData(groupId);
            await interaction.editReply({ content: null, embeds: [buildFundsEmbed(data)] });
        } catch (err) {
            await interaction.editReply({ content: errorMessage(err) });
        }
    },
};