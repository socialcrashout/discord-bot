const { MessageFlags, PermissionFlagsBits } = require("discord.js");
const { buildPanelContainer } = require("../utils/ticketManager");

module.exports = {
    name: "panel",
    description: "Sends the ticket panel in this channel.",
    async execute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply("You don't have permission to do that.").catch(() => {});
        }

        const container = buildPanelContainer();

        await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });

        // clean up the invoking message so the channel stays tidy
        message.delete().catch(() => {});
    },
};