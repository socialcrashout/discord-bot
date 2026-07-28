const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('feedback_give')
        .setDescription('Give feedback to a staff')
        .addUserOption(option =>
            option.setName('staff')
                .setDescription('Ping the staff')
                .setRequired(true))
        .addStringOption(option =>
            option.setName("stars")
                .setDescription("Amount of stars.")
                .setRequired(true)
                .addChoices(
                    { name: "⭐", value: "⭐" },
                    { name: "⭐⭐", value: "⭐⭐" },
                    { name: "⭐⭐⭐", value: "⭐⭐⭐" },
                    { name: "⭐⭐⭐⭐", value: "⭐⭐⭐⭐" },
                    { name: "⭐⭐⭐⭐⭐", value: "⭐⭐⭐⭐⭐" }
                ))
        .addStringOption(option =>
            option.setName('product')
                .setDescription('Product')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('feedback')
                .setDescription('Feedback')
                .setRequired(true)),

    async execute(interaction) {
        const staff = interaction.options.getUser('staff');
        const stars = interaction.options.getString("stars");
        const product = interaction.options.getString('product');
        const feedback = interaction.options.getString('feedback');

        const embed = new EmbedBuilder()
            .setColor('#6da9f1')
            .setAuthor({
                name: `Staff Feedback by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .addFields(
                { name: `Staff`, value: `${staff}`, inline: true },
                { name: `Rating`, value: `${stars}`, inline: true },
                { name: `Product`, value: `${product}`, inline: true },
                { name: `Feedback`, value: `${feedback}`, inline: false }
            )
            .setTimestamp();

        const staffeedbackchannelid = 'CHANNEL_ID_WHERE_THE_STAFF_FEEDBACK_IS_GOING_TO_BE_SENT';
        const staffeedbackchannel = interaction.guild.channels.cache.get(staffeedbackchannelid);

        if (!staffeedbackchannel) {
            return interaction.reply({ content: 'Staff Feedback channel not found.', ephemeral: true });
        }

        if (!staffeedbackchannel.permissionsFor(interaction.client.user).has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({ content: 'I do not have permission to send messages in the Staff Feedback channel.', ephemeral: true });
        }

        await staffeedbackchannel.send({ content: `<@${designer.id}>`, embeds: [embed] });
        await interaction.reply({ content: 'Staff Feedback has been submitted and sent to the Staff Feedback channel.', ephemeral: true });
    }
};