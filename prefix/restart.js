const { exec } = require('child_process');

// Only these user IDs are allowed to run this command.
const ALLOWED_USER_IDS = [
    "1504311819458580531", // replace with your Discord user ID
];

module.exports = {
    name: 'restart',

    async execute(message, args, client) {
        if (!ALLOWED_USER_IDS.includes(message.author.id)) {
            return message.reply("You don't have permission to do that.").catch(console.error);
        }

        const msg = await message.reply('Pulling latest code from GitHub...').catch(console.error);

        exec('git pull', { cwd: process.cwd() }, async (err, stdout, stderr) => {
            if (err) {
                client.logs.error('git pull failed:', err);
                return msg.edit(
                    `❌ Failed to pull latest code:\n\`\`\`${(stderr || err.message).slice(0, 1800)}\`\`\``
                ).catch(console.error);
            }

            client.logs.info('git pull output:', stdout);

            const noChanges = stdout.includes('Already up to date');
            await msg.edit(
                noChanges
                    ? '✅ Already up to date. Restarting anyway...'
                    : `✅ Pulled latest code:\n\`\`\`${stdout.slice(0, 1800)}\`\`\`\nRestarting...`
            ).catch(console.error);

            // Non-zero exit so Railway's default "On Failure" restart policy
            // brings the process back up.
            setTimeout(() => process.exit(1), 1000);
        });
    }
};