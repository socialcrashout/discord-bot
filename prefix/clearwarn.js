const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { removeWarningByCase } = require('../utils/warnings');

const LOG_CHANNEL_ID = '1506450870269906944';

module.exports = {
    name: 'clearwarn',
    description: 'Remove a specific warning by its case number',
    // Usage: -clearwarn <caseNumber>
    async execute(message, args) {
        const errorReply = (text) => message.reply({
            components: [new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(text)
            )],
            flags: MessageFlags.IsComponentsV2,
        });

        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return errorReply('You do not have permission to clear warnings.');
        }

        // Accepts flexible input like "9", "#9", "@user Case #9", etc. —
        // finds the first standalone number anywhere in the message args.
        const caseNumber = args
            .map(a => a.replace(/\D/g, ''))
            .find(a => a.length > 0);

        if (!caseNumber) return errorReply('<:WarningIcon:1508245066135765034> Please provide a case number. Usage: `-clearwarn <caseNumber>`');

        const removed = removeWarningByCase(message.guild.id, parseInt(caseNumber, 10));
        if (!removed) return errorReply(`No warning found with Case #${caseNumber}.`);

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const logContainer = new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:ShieldCheck:1530775133713731826> Clearwarn Command Used!\n` +
                    `-# **<:sig:1530774414436729012> Used By:** ${message.author}\n` +
                    `**<:user:1530778349184618627> Warning Removed:** Case #${caseNumber} (was ${removed.userTag})\n` +
                    `**<:Comment:1530774457961025618> Original Reason:** ${removed.reason}\n` +
                    `**<:Dot:1530774492412907721> Channel:** ${message.channel}\n` +
                    `**<:Calendar:1530778367966843010> Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                )
            );

            await logChannel.send({
                components: [logContainer],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            });
        }

        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Warning Cleared**\n` +
                `**Case #:** ${caseNumber}\n` +
                `**User:** ${removed.userTag}\n` +
                `**Original Reason:** ${removed.reason}`
            )
        );

        await message.channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};