const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} = require('discord.js');

// config
const THANK_YOU_CHANNEL_ID = '1502517147673563266';
const YOUR_GUILD_ID = '1502510812441608222';
const THANK_YOU_COOLDOWN = 60000; // 1 min (in ms)
const FOOTER_IMAGE_URL = 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw'; // paste your footer image link here

const userClanTagStates = new Map();
const recentThankYous = new Map();

async function getCurrentClanTagState(user, client) {
    try {
        const fullUser = await client.users.fetch(user.id, { cache: true });

        if (!fullUser.primaryGuild || !fullUser.primaryGuild.identityEnabled) {
            return {
                hasOfficialTag: false,
                guildId: null,
                tagText: null
            };
        }

        const primaryGuild = fullUser.primaryGuild;
        const guildId = primaryGuild.identityGuildId;
        const tagText = primaryGuild.tag;

        let badgeUrl = null;
        try {
            badgeUrl = fullUser.guildTagBadgeURL({ format: 'png', size: 32 });
        } catch (e) {}

        return {
            hasOfficialTag: true,
            guildId: guildId,
            tagText: tagText,
            badgeUrl: badgeUrl
        };

    } catch (error) {
        console.error('[GuildTag] failed to fetch clan tag state:', error);
        return {
            hasOfficialTag: false,
            guildId: null,
            tagText: null
        };
    }
}

function hasEquippedOurClanTag(currentState) {
    return currentState.hasOfficialTag && currentState.guildId === YOUR_GUILD_ID;
}

function didJustEquipClanTag(currentState, previousState) {
    const currentlyHasOurTag = hasEquippedOurClanTag(currentState);
    if (!currentlyHasOurTag) return false;
    if (!previousState) return true;

    return !hasEquippedOurClanTag(previousState);
}

async function sendClanTagEquipEmbed(client, user, clanTagInfo) {
    try {
        const thankYouChannel = client.channels.cache.get(THANK_YOU_CHANNEL_ID);

        if (!thankYouChannel) {
            console.error('[GuildTag] thank you channel not found, check the thank you channel ID.');
            return;
        }

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## <:confetti:1502514532331946006> Clan Tag Equipped\n` +
                    `Thanks, ${user} — you've successfully equipped our clan tag. Thanks for supporting us! <:cheers:1502514532331946006>`
                )
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(FOOTER_IMAGE_URL)
                )
            );

        await thankYouChannel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });

        console.log(`[GuildTag] sent thank you for ${user.tag} (tag: ${clanTagInfo.tagText})`);

    } catch (error) {
        console.error('[GuildTag] error sending embed:', error);
    }
}

async function handleUserUpdate(oldUser, newUser, client) {
    try {
        const currentState = await getCurrentClanTagState(newUser, client);

        const previousState = userClanTagStates.get(newUser.id);

        userClanTagStates.set(newUser.id, {
            hasOfficialTag: currentState.hasOfficialTag,
            guildId: currentState.guildId,
            tagText: currentState.tagText,
            lastUpdated: Date.now()
        });

        if (didJustEquipClanTag(currentState, previousState)) {
            const lastThankYou = recentThankYous.get(newUser.id);
            const now = Date.now();

            if (lastThankYou && (now - lastThankYou) < THANK_YOU_COOLDOWN) {
                console.log(`[GuildTag] skipping ${newUser.tag}, cooldown active`);
                return;
            }

            console.log(`[GuildTag] ${newUser.tag} equipped our tag: ${currentState.tagText}`);

            recentThankYous.set(newUser.id, now);

            await sendClanTagEquipEmbed(client, newUser, currentState);

            // cleanup after cooldown expires
            setTimeout(() => {
                recentThankYous.delete(newUser.id);
            }, THANK_YOU_COOLDOWN * 2);
        }

    } catch (error) {
        console.error('[GuildTag] error in handleUserUpdate:', error);
    }
}

function initializeUserState(userId, tagState) {
    userClanTagStates.set(userId, {
        hasOfficialTag: tagState.hasOfficialTag,
        guildId: tagState.guildId,
        tagText: tagState.tagText,
        lastUpdated: Date.now()
    });
}

// optional startup scan, logs everyone who has the tag equipped
async function scanAndInitializeUsers(client, guildId) {
    try {
        console.log('[GuildTag] scanning users...');
        const mainGuild = await client.guilds.fetch(guildId);
        const members = await mainGuild.members.fetch();

        const realUsers = Array.from(members.values()).filter(m => !m.user.bot);
        console.log(`[GuildTag] ${realUsers.length} users to check`);

        const results = await Promise.allSettled(
            realUsers.map(async (member) => {
                const tagState = await getCurrentClanTagState(member.user, client);
                return {
                    member,
                    tagState,
                    hasOurTag: hasEquippedOurClanTag(tagState)
                };
            })
        );

        const usersWithTag = results
            .filter(r => r.status === 'fulfilled' && r.value.hasOurTag)
            .map(r => ({
                id: r.value.member.user.id,
                tag: r.value.member.user.tag,
                tagText: r.value.tagState.tagText,
                guildId: r.value.tagState.guildId
            }));

        const totalWithTags = results.filter(r =>
            r.status === 'fulfilled' && r.value.tagState && r.value.tagState.hasOfficialTag
        ).length;

        console.log(`[GuildTag] done — ${realUsers.length} scanned | ${totalWithTags} with any tag | ${usersWithTag.length} with our tag`);

        if (usersWithTag.length > 0) {
            console.log(`[GuildTag] users with our tag (${guildId}):`);
            usersWithTag.forEach(u => {
                console.log(`  - ${u.tag} (${u.id}) | ${u.tagText}`);
            });
        } else {
            console.log(`[GuildTag] nobody has guild tag ${guildId} equipped`);
        }

        // comment out below if you don't want the startup scan logs

        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value.tagState) {
                const userId = r.value.member.user.id;
                const tagState = r.value.tagState;
                initializeUserState(userId, tagState);
            }
        });
    } catch (error) {
        console.error('[GuildTag] scan failed:', error);
    }
}

module.exports = {
    name: 'guildtagthanks',
    description: 'guild tag thank-you handler',
    execute: handleUserUpdate,
    scanAndInitializeUsers,
    initializeUserState,
    getCurrentClanTagState,
    hasEquippedOurClanTag,
};