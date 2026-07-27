const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member) {
    const channel = member.guild.channels.cache.get("1529922818253390017");
    if (!channel) return;

    const welcomeMessage = `<a:wave_animated2:1531130218662596763> **Welcome** ${member} to Socialcrashout's Commission Hub. We ensure that **excellence** is a **standard**. `;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("disablee22")
        .setLabel(`${member.guild.memberCount}`)
        .setEmoji("1531130380508332062")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    try {
      await channel.send({ content: welcomeMessage, components: [row] });
    } catch (err) {
      console.error("Failed to send welcome message:", err);
    }

    const roleId = "1429526290595188877";
    const role = member.guild.roles.cache.get(roleId);
    if (role) {
      try {
        await member.roles.add(role);
      } catch (err) {
        console.error(
          `Failed to add role ${roleId} to ${member.user.tag}:`,
          err,
        );
      }
    } else {
      console.warn(`Role ID ${roleId} not found in guild ${member.guild.name}`);
    }
  },
};