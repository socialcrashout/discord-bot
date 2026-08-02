const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const REQUIRED_ROLE_IDS = [
    '1504311819458580531',
    '1504312910862880879',
    '1504313264576925757'
];

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    name: 'rename',
    description: 'Rename this channel',

    // Usage: -rename <new name>

    async execute(message, args) {

        const errorReply = (text) => message.reply({
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(text)
                )
            ],
            flags: MessageFlags.IsComponentsV2,
        });

        // Role restriction
        if (!message.member.roles.cache.some(role => REQUIRED_ROLE_IDS.includes(role.id))) {
            return errorReply('<:warning:1531049700520624278> You do not have permission to use this command.');
        }

        const newName = args.join(' ').trim();

        if (!newName) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please provide a new channel name. Usage: `-rename <new name>`'
            );
        }

        // Discord channel name rules: lowercase, no spaces (spaces become hyphens), max 100 chars
        const formattedName = newName
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-_ก-๙一-龥぀-ゟ゠-ヿ]/g, '')
            .slice(0, 100);

        if (!formattedName) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> That name is not valid after formatting. Please try a different name.'
            );
        }

        const oldName = message.channel.name;

        try {
            await message.channel.setName(formattedName);

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:ShieldCheck:1502514212168274061> Rename Command Used!\n` +
                            `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                            `**<:person:1502514200705105981> Old Name:** ${oldName}\n` +
                            `**<:Comment:1502512880493400196> New Name:** ${formattedName}\n` +
                            `**<:Dot:1502513706347528213> Channel:** ${message.channel}\n` +
                            `**<:Calendar:1502513561866473734> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        )
                    );

                await logChannel.send({
                    components: [logContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                });
            }

            const confirmation = await message.channel.send({
                components: [
                    new ContainerBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `✅ Channel renamed to **${formattedName}**`
                        )
                    )
                ],
                flags: MessageFlags.IsComponentsV2,
            });

            setTimeout(() => confirmation.delete().catch(() => {}), 4000);

        } catch (error) {
            console.error(error);
            if (error.code === 50013) {
                return errorReply('<:warning:1531049700520624278> I do not have permission to rename this channel.');
            }
            await message.channel.send('Something went wrong while renaming the channel.');
        }
    },
};