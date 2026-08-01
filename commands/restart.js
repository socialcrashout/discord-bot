const { SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');

// Only these user IDs are allowed to run this command.
const ALLOWED_USER_IDS = [
    "1504311819458580531", // replace with your Discord user ID
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Pull latest code from GitHub and restart the bot'),

    async execute(interaction, client) {
        if (!ALLOWED_USER_IDS.includes(interaction.user.id)) {
            return interaction.reply({ content: "You don't have permission to do that.", ephemeral: true }).catch(console.error);
        }

        await interaction.deferReply({ ephemeral: true });

        exec('git pull', { cwd: process.cwd() }, async (err, stdout, stderr) => {
            if (err) {
                client.logs.error('git pull failed:', err);
                return interaction.editReply(
                    `❌ Failed to pull latest code:\n\`\`\`${(stderr || err.message).slice(0, 1800)}\`\`\``
                ).catch(console.error);
            }

            client.logs.info('git pull output:', stdout);

            const noChanges = stdout.includes('Already up to date');
            await interaction.editReply(
                noChanges
                    ? '✅ Already up to date. Restarting anyway...'
                    : `✅ Pulled latest code:\n\`\`\`${stdout.slice(0, 1800)}\`\`\`\nRestarting...`
            ).catch(console.error);

            // Non-zero exit so Railway's default "On Failure" restart policy
            // brings the process back up. If you set your Railway service's
            // restart policy to "Always" instead, you can use exit(0) here.
            setTimeout(() => process.exit(1), 1000);
        });
    }
};