const { Events } = require("discord.js");
const giveaways = require("../utils/giveawayManager");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        giveaways.init(client);
    },
};