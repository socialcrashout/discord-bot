const { renameCurrentTicket } = require('../utils/ticketsystem');
module.exports = { name: 'rename', async execute(message, args) { const handled = await renameCurrentTicket(message, args.join(' ')); if (!handled) await message.reply('This command can only be used by ticket staff inside an active ticket.'); } };
