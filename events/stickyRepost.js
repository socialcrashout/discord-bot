const { Events } = require('discord.js');
const stickyManager = require('../utils/stickyManager');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const sticky = stickyManager.getSticky(message.channel.id);
        if (!sticky) return;

        await stickyManager.repostSticky(message.channel);
    },
};