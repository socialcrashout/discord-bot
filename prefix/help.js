const fs = require('fs');
const path = require('path');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    name: 'help',
    description: 'Show all available commands',

    // Usage: -help

    async execute(message, args) {

        const commandsPath = __dirname;
        const files = fs.readdirSync(commandsPath).filter(
            file => file.endsWith('.js') && file !== path.basename(__filename)
        );

        const commands = [];

        for (const file of files) {
            try {
                delete require.cache[require.resolve(path.join(commandsPath, file))];
                const cmd = require(path.join(commandsPath, file));
                if (cmd && cmd.name) {
                    commands.push({
                        name: cmd.name,
                        description: cmd.description || 'No description provided'
                    });
                }
            } catch (err) {}
        }

        commands.sort((a, b) => a.name.localeCompare(b.name));

        const prefix = '-';

        const commandList = commands
            .map(cmd => `**\`${prefix}${cmd.name}\`** — ${cmd.description}`)
            .join('\n');

        const helpContainer = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1502514212168274061> Command List\n` +
                    `-# **<:sig:1502514350014070795> Requested By:** ${message.author}\n` +
                    `**<:Dot:1502513706347528213> Total Commands:** ${commands.length}\n\n` +
                    `${commandList}`
                )
            );

        await message.reply({
            components: [helpContainer],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};