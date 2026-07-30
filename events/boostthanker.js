const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} = require("discord.js");

// ==================== CONFIG ====================
const SPONSORS_CHANNEL_ID = "1502517147673563266"; // <-- replace with real channel ID
const BOOST_COOLDOWN = 60000; // 1 min (in ms) — prevents duplicate posts
const FOOTER_IMAGE_URL = "https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw";
const ROCKET_EMOJI = "<:roccket:1502514543333736591>";
// ==================================================

const recentBoostThanks = new Map();

function didJustStartBoosting(oldMember, newMember) {
    return !oldMember.premiumSince && !!newMember.premiumSince;
}

async function sendBoostThankYou(client, member) {
    try {
        const sponsorsChannel = client.channels.cache.get(SPONSORS_CHANNEL_ID);

        if (!sponsorsChannel) {
            console.error("[BoostThanks] sponsors channel not found, check the channel ID.");
            return;
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${ROCKET_EMOJI} Thank You for Boosting!\n` +
                    `Big shoutout to ${member} for boosting the server! Your support helps unlock exclusive perks like personalized role designs, special server tags, and overall improvements that make the community even better. Thanks a lot for being part of the growth!`
                )
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(FOOTER_IMAGE_URL)
                )
            );

        await sponsorsChannel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });

        console.log(`[BoostThanks] sent thank you for ${member.user.tag}`);
    } catch (error) {
        console.error("[BoostThanks] error sending embed:", error);
    }
}

module.exports = {
    name: "guildMemberUpdate",

    async execute(oldMember, newMember, client) {
        try {
            if (!didJustStartBoosting(oldMember, newMember)) return;

            const bot = client || newMember.client;
            const lastThanked = recentBoostThanks.get(newMember.id);
            const now = Date.now();

            if (lastThanked && (now - lastThanked) < BOOST_COOLDOWN) {
                console.log(`[BoostThanks] skipping ${newMember.user.tag}, cooldown active`);
                return;
            }

            console.log(`[BoostThanks] ${newMember.user.tag} started boosting`);

            recentBoostThanks.set(newMember.id, now);

            await sendBoostThankYou(bot, newMember);

            setTimeout(() => {
                recentBoostThanks.delete(newMember.id);
            }, BOOST_COOLDOWN * 2);

        } catch (error) {
            console.error("[BoostThanks] error in guildMemberUpdate:", error);
        }
    }
};