const guildTagThanks = require('../utils/guildTagThanks');

module.exports = {
    name: 'userUpdate',
    async execute(oldUser, newUser, client) {
        if (newUser.bot) return;
        await guildTagThanks.execute(oldUser, newUser, client);
    }
};