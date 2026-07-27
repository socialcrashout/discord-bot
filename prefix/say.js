const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const ALLOWED_ROLE_ID = '1529922817578106961';
const LOG_CHANNEL_ID = '1529922818253390018';

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
              `## <:ShieldCheck:1530775133713731826> Say Command Used!\n` +
              `-# **<:sig:1530774414436729012> Used by:** ${message.author}\n` +
              `**<:Comment:1530774457961025618> Said:** ${content}\n` +
              `**<:Dot:1530774492412907721> Channel:** ${message.channel}`
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