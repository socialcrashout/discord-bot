const { Events } = require("discord.js");
const giveaways = require("../lib/giveawayManager");

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        giveaways.init(client);
    },
};