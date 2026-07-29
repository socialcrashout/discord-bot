const {
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} = require('discord.js');

const { removeWarningByCase } = require('../utils/warnings');

const LOG_CHANNEL_ID = '1506450870269906944';

const ALLOWED_ROLE_IDS = [
    '1504311819458580531',
    '1504313264576925757',
    '1504312910862880879',
    '1504320706341502996'
];

module.exports = {
    name: 'clearwarn',
    description: 'Remove a specific warning by its case number',

    // Usage: -clearwarn <caseNumber>

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
        if (!message.member.roles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id))) {
            return errorReply('You do not have the required role to use this command.');
        }

        // Accepts flexible input like "9", "#9", "@user Case #9", etc.
        const caseNumber = args
            .map(a => a.replace(/\D/g, ''))
            .find(a => a.length > 0);

        if (!caseNumber) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please provide a case number. Usage: `-clearwarn <caseNumber>`'
            );
        }

        const removed = removeWarningByCase(
            message.guild.id,
            parseInt(caseNumber, 10)
        );

        if (!removed) {
            return errorReply(`No warning found with Case #${caseNumber}.`);
        }

        const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

        if (logChannel) {
            const logContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## <:ShieldCheck:1502514212168274061> Clearwarn Command Used!\n` +
                        `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                        `**<:person:1502514200705105981> Warning Removed:** Case #${caseNumber} (was ${removed.userTag})\n` +
                        `**<:Comment:1502512880493400196> Original Reason:** ${removed.reason}\n` +
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

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Warning Cleared**\n` +
                    `**Case #:** ${caseNumber}\n` +
                    `**User:** ${removed.userTag}\n` +
                    `**Original Reason:** ${removed.reason}`
                )
            );

        await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};