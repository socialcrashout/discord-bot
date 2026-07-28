const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

const LOG_CHANNEL_ID = '1506450870269906944';
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
            await sleep(1000); // avoid hitting rate limits on individual deletes
        } catch (err) {
            // message may already be gone, or delete failed — skip it
        }
    }

    return deletedCount;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete messages from this channel (no age limit)')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the purge')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const errorReply = (text) => interaction.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return errorReply('You do not have permission to manage messages.');
        }

        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const fetched = await interaction.channel.messages.fetch({ limit: 100 });
            const toDelete = target
                ? fetched.filter(m => m.author.id === target.id).first(amount)
                : [...fetched.values()].slice(0, amount);

            const deletedCount = await deleteMessages(interaction.channel, new Map(toDelete.map(m => [m.id, m])));

            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logContainer = new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Purge Command Used!\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${interaction.user}\n` +
                        `**<:person:1502514200705105981> Messages Deleted:** ${deletedCount}${target ? ` (from ${target.tag})` : ''}\n` +
                        `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                        `**<:Dot:1502513706347528213> Channel:** ${interaction.channel}\n` +
                        `**<:Calendar:1502513561866473734> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    )
                );

                await logChannel.send({
                    components: [logContainer],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                });
            }

            await interaction.editReply({
                content: `✅ Deleted ${deletedCount} message(s)${target ? ` from ${target.tag}` : ''}`,
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Something went wrong while purging messages.' });
        }
    },
};