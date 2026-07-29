const { EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');

/**
 * Add this to your .env:
 * FUNDS_ALLOWED_ROLES=123456789012345678,987654321098765432
 * (comma-separated role IDs allowed to use -funds)
 */
const ALLOWED_ROLE_IDS = (process.env.FUNDS_ALLOWED_ROLES || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function hasPermission(member) {
    if (!member || ALLOWED_ROLE_IDS.length === 0) return false;
    return member.roles.cache.some((role) => ALLOWED_ROLE_IDS.includes(role.id));
}

function buildNoPermissionEmbed() {
    return new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔒 Access Denied')
        .setDescription("You don't have permission to use this command.")
        .setFooter({ text: 'Contact an administrator if you think this is a mistake.' })
        .setTimestamp();
}

function buildFundsEmbed({ groupId, groupName, groupFunds, pending, iconURL }) {
    const total = groupFunds + pending;

    return new EmbedBuilder()
        .setColor('#57F287')
        .setAuthor({
            name: groupName ? `${groupName} — Group Funds` : `Group Funds — ID ${groupId}`,
            iconURL,
        })
        .setThumbnail(iconURL || null)
        .addFields(
            { name: '💰 Current Funds', value: `**R$${groupFunds.toLocaleString()}**`, inline: true },
            { name: '⏳ Pending Revenue', value: `**R$${pending.toLocaleString()}**`, inline: true },
            { name: '📊 Total', value: `**R$${total.toLocaleString()}**`, inline: true }
        )
        .setFooter({ text: 'Roblox Group Funds' })
        .setTimestamp();
}

async function fetchFundsData(groupId) {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);

    const [groupFunds, groupInfo] = await Promise.all([
        noblox.getGroupFunds(groupId),
        noblox.getGroup(groupId).catch(() => null),
    ]);

    let pending = 0;
    try {
        const revenueSummary = await noblox.getGroupRevenueSummary(groupId, 'Month');
        pending = revenueSummary.pendingRobux ?? revenueSummary.pending ?? 0;
    } catch (e) {
        // Pending revenue endpoint can fail independently of group funds — don't block the whole command.
    }

    return {
        groupId,
        groupName: groupInfo?.name,
        iconURL: groupInfo?.iconUrl || undefined,
        groupFunds,
        pending,
    };
}

function errorMessage(err) {
    if (err.message?.includes('Insufficient permissions')) {
        return '❌ The Roblox account used does not have permission to view group funds.';
    }
    if (err.message?.includes('Cookie')) {
        return '❌ Invalid Roblox cookie. Make sure `ROBLOX_COOKIE` is set correctly in your `.env` file.';
    }
    return '❌ Failed to fetch group funds. Check the console for more info.';
}

module.exports = {
    hasPermission,
    buildNoPermissionEmbed,
    buildFundsEmbed,
    fetchFundsData,
    errorMessage,
};