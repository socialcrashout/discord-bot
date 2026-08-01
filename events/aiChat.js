// events/aiChat.js
const { Events } = require('discord.js');
const aiManager = require('../utils/aiManager');

module.exports = {
    name: Events.MessageCreate,
    once: false,
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.mentions.has(client.user)) return;

        // Don't fire on prefix commands (those already start with process.env.PREFIX)
        if (process.env.PREFIX && message.content.startsWith(process.env.PREFIX)) return;

        const content = message.content.replace(/<@!?\d+>/g, '').trim();

        await message.channel.sendTyping();

        try {
            if (aiManager.isFirstTouch(message.channel.id) && (!content || /^(hi|hello|hey)\W*$/i.test(content))) {
                aiManager.seedIntro(message.channel.id, content);
                await message.reply(aiManager.INTRO_MESSAGE);
                return;
            }

            const reply = await aiManager.getAIResponse(message.channel.id, content);
            await message.reply(reply);
        } catch (err) {
            client.logs.error('AI chat error:', err);
            await message.reply("Sorry, I hit an error trying to think of a reply.").catch(() => {});
        }
    },
};