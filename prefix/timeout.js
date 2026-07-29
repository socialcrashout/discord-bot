const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const getNextCase = require('../utils/getNextCase');
const { addModLog } = require('../utils/modlogs');

const ALLOWED_ROLE_ID = 'YOUR_ROLE_ID_HERE';
const LOG_CHANNEL_ID = '1506450870269906944';

// Parses strings like "10m", "1h", "2d" into milliseconds. Max 28 days.
function parseDuration(input) {
    const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input.trim());
    if (!match) return null;

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    const ms = amount * multipliers[unit];

    if (ms > 28 * 24 * 60 * 60 * 1000) return null;

    return ms;
}

module.exports = {
    name: 'timeout',
    description: 'Timeout a member for a set duration',

    // Usage: -timeout @user 10m reason...
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
        if (!message.member.roles.cache.has(ALLOWED_ROLE_ID)) {
            return errorReply('You do not have permission to use this command.');
        }

        const target = message.mentions.members?.first();

        if (!target) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please mention a member. Usage: `-timeout @user 10m [reason]`'
            );
        }

        const durationInput = args[1];

        if (!durationInput) {
            return errorReply(
                '<:WarningIcon:1508245066135765034> Please provide a duration. Usage: `-timeout @user 10m [reason]`'
            );
        }

        const reason = args.slice(2).join(' ') || 'No reason provided';

        if (target.id === message.author.id) {
            return errorReply('You cannot timeout yourself.');
        }

        if (!target.moderatable) {
            return errorReply('I cannot timeout this member. They may have a higher role than me or I lack permissions.');
        }

        const ms = parseDuration(durationInput);

        if (!ms) {
            return errorReply(
                '<:warning:1531049700520624278> Invalid duration. Use `10m`, `1h`, or `2d` (max 28d).'
            );
        }

        try {
            await target.timeout(ms, reason);

            const caseNumber = await getNextCase(message.guild.id);
            const timestamp = Math.floor(Date.now() / 1000);

            addModLog(message.guild.id, {
                caseNumber,
                type: 'timeout',
                userId: target.id,
                userTag: target.user.tag,
                moderatorId: message.author.id,
                moderatorTag: message.author.tag,
                reason,
                duration: durationInput,
                timestamp,
            });

            const logChannel = message.guild.channels.cache.get(LOG_CHANNEL_ID);

            if (logChannel) {
                const logContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## <:ShieldCheck:1502514212168274061> Timeout Command Used! | Case #${caseNumber}\n` +
                            `-# **<:sig:1502514350014070795> Used By:** ${message.author}\n` +
                            `**<:person:1502514200705105981> User Timed Out:** ${target.user.tag} (${target.id})\n` +
                            `**<:Comment:1502512880493400196> Reason:** ${reason}\n` +
                            `**<:Dot:1502513706347528213> Channel:** ${message.channel}\n` +
                            `**<:Calendar:1502513561866473734> Timestamp:** <t:${timestamp}:F>`
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
                        `**Member Timed Out** | Case #${caseNumber}\n` +
                        `**User:** ${target.user.tag} (${target.id})\n` +
                        `**Moderator:** ${message.author.tag}\n` +
                        `**Duration:** ${durationInput}\n` +
                        `**Reason:** ${reason}`
                    )
                );

            await message.channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error(error);
            await errorReply('Something went wrong while trying to timeout that member.');
        }
    },
};