const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const LOG_CHANNEL_ID = '1506450870269906944';
const REQUIRED_ROLE_ID = 'YOUR_ROLE_ID';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Deletes a batch of messages, using fast bulk delete for anything under 14 days
// old, and falling back to slow one-by-one deletion (no age limit) for the rest.
async function deleteMessages(channel, messages) {
    const now = Date.now();
    const recent = [];
    const old = [];

    for (const msg of messages.values()) {
        if (now - msg.createdTimestamp < FOURTEEN_DAYS_MS) {
            recent.push(msg);
        } else {
            old.push(msg);
        }
    }

    let deletedCount = 0;

    if (recent.length > 0) {
        const deleted = await channel.bulkDelete(recent, true);
        deletedCount += deleted.size;
    }

    for (const msg of old) {
        try {
            await msg.delete();
            deletedCount++;
            await sleep(1000);
        } catch (err) {}
    }

    return deletedCount;
}

module.exports = {
    name: 'purge',
    description: 'Delete messages from this channel (no age limit)',
    // Usage: -purge <amount> [@user] [reason...]
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return errorReply('<:warning:1531049700520624278> You do not have permission to use this command.');
        }

        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return errorReply('You do not have permission to manage messages.');
        }

        const amount = parseInt(args[0], 10);
        if (!amount || amount < 1 || amount > 100) {
            return errorReply('<:WarningIcon:1508245066135765034> Please provide a number between 1 and 100. Usage: `-purge <amount> [@user] [reason]`');
        }

        const target = message.mentions.users?.first();
        const reasonArgs = target ? args.slice(2) : args.slice(1);
        const reason = reasonArgs.join(' ') || 'No reason provided';

        await message.delete().catch(() => {});

        try {
            const fetched = await message.channel.messages.fetch({ limit: 100 });

            const toDelete = target
                ? fetched.filter(m => m.author.id === target.id).first(amount)
                : [...fetched.values()].slice(0, amount);

            const deletedCount = await deleteMessages(
                message.channel,
                new Map(toDelete.map(m => [m.id, m]))
            );

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Purge Command Used!\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                        `**<:person:1502514200705105981> Messages Deleted:** ${deletedCount}${target ? ` (from ${target.tag})` : ''}\n` +
                        `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
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
                components: [new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `✅ Deleted ${deletedCount} message(s)${target ? ` from ${target.tag}` : ''}`
                    )
                )],
                flags: MessageFlags.IsComponentsV2,
            });

            setTimeout(() => confirmation.delete().catch(() => {}), 4000);

        } catch (error) {
            console.error(error);
            await message.channel.send('Something went wrong while purging messages.');
        }
    },
};