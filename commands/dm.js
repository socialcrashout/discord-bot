const { SlashCommandBuilder } = require('@discordjs/builders');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dmuser')
    .setDescription('DM a user and log the interaction')
    .addUserOption(option => option.setName('user').setDescription('The user to DM').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('The message to send').setRequired(true)),

  async execute(interaction) {
    const staffRoleIds = ['1504311819458580531'];

    if (!interaction.member.roles.cache.some(role => staffRoleIds.includes(role.id))) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const staff = interaction.user;
    const user = interaction.options.getUser('user');
    const message = interaction.options.getString('message');

    try {
      await user.send(message);

      const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## <:ShieldCheck:1502514212168274061> DM Command Used!\n` +
              `-# **<:sig:1502514350014070795> Used by:** ${staff}\n` +
              `**<:Comment:1502512880493400196> Sent to:** ${user} (${user.id})\n` +
              `**<:Dot:1502513706347528213> Message:** ${message}`
            )
          );

        await logChannel.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        });
      }

      await interaction.reply({ content: `Successfully DM'd ${user.tag} and logged the interaction.`, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'There was an error sending the DM or logging the interaction.', ephemeral: true });
    }
  }
};