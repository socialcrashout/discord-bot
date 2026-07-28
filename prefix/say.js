const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const ALLOWED_ROLE_ID = '1504311819458580531';
const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
  name: "say",
  async execute(message, args) {

    if (!message.member.roles.cache.has(ALLOWED_ROLE_ID)) return;

    const content = args.join(" ");
    if (!content) return;

    await message.delete().catch(() => {});

    await message.channel.send(content);

    // Log the usage
    try {
      const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel) {
        const container = new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `## <:ShieldCheck:1502514212168274061> Say Command Used!\n` +
              `-# **<:sig:1502514350014070795> Used by:** ${message.author}\n` +
              `**<:Comment:1502512880493400196> Said:** ${content}\n` +
              `**<:Dot:1502513706347528213> Channel:** ${message.channel}`
            )
          );

        await logChannel.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] }, 
        });
      }
    } catch (err) {
      console.error('Failed to log say command:', err);
    }
  }
};