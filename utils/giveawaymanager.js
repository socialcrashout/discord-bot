const fs = require("fs");
const path = require("path");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const DATA_PATH = path.join(__dirname, "..", "data", "giveaways.json");

// giveaway shape:
// {
//   id (messageId), channelId, guildId, hostId,
//   prize, winnersCount, endTime (ms epoch),
//   requirements: string|null, bannerUrl: string|null,
//   pingType: 'none'|'here'|'everyone',
//   entries: [userId,...], ended: bool
// }

const active = new Map();   // id -> giveaway object
const timers = new Map();   // id -> Timeout handle
const drafts = new Map();   // draftId -> in-progress giveaway builder (pre-post)

const COLOR_ACTIVE = 0xF2C4C0; // soft pink/gold accent
const COLOR_ENDED = 0x2B2D31;

function loadData() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            fs.writeFileSync(DATA_PATH, "[]");
        }
        const raw = fs.readFileSync(DATA_PATH, "utf8");
        const arr = JSON.parse(raw || "[]");
        active.clear();
        for (const g of arr) active.set(g.id, g);
    } catch (err) {
        console.error("[giveaways] failed to load data:", err);
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_PATH, JSON.stringify([...active.values()], null, 2));
    } catch (err) {
        console.error("[giveaways] failed to save data:", err);
    }
}

// Accepts strings like "1d2h30m", "45m", "2h", "10s"
function parseDuration(input) {
    if (!input) return null;
    const regex = /(\d+)\s*(d|h|m|s)/gi;
    let match;
    let ms = 0;
    let found = false;
    while ((match = regex.exec(input)) !== null) {
        found = true;
        const amount = parseInt(match[1], 10);
        switch (match[2].toLowerCase()) {
            case "d": ms += amount * 24 * 60 * 60 * 1000; break;
            case "h": ms += amount * 60 * 60 * 1000; break;
            case "m": ms += amount * 60 * 1000; break;
            case "s": ms += amount * 1000; break;
        }
    }
    return found ? ms : null;
}

function pingContent(pingType) {
    if (pingType === "everyone") return "@everyone";
    if (pingType === "here") return "@here";
    return null;
}

function allowedMentionsFor(pingType) {
    if (pingType === "everyone") return { parse: ["everyone"] };
    if (pingType === "here") return { parse: ["everyone"] }; // @here also needs 'everyone' parse permission
    return { parse: [] };
}

function buildEmbed(giveaway, ended = false, winners = []) {
    const endedAt = Math.floor(giveaway.endTime / 1000);
    const embed = new EmbedBuilder()
        .setColor(ended ? COLOR_ENDED : COLOR_ACTIVE)
        .setTitle(ended ? "🎉 GIVEAWAY ENDED 🎉" : "🎉 GIVEAWAY 🎉")
        .setFooter({ text: `${giveaway.entries.length} entr${giveaway.entries.length === 1 ? "y" : "ies"} • Hosted by ${giveaway.hostName || "staff"}` });

    let desc = `**Prize:** ${giveaway.prize}\n`;
    desc += `**Winners:** ${giveaway.winnersCount}\n`;
    desc += `**Hosted by:** <@${giveaway.hostId}>\n`;
    desc += ended
        ? `**Ended:** <t:${endedAt}:R>\n`
        : `**Ends:** <t:${endedAt}:R> (<t:${endedAt}:f>)\n`;

    if (giveaway.requirements) {
        desc += `\n**Requirements:**\n${giveaway.requirements}\n`;
    }

    if (ended) {
        desc += winners.length
            ? `\n**Winner${winners.length > 1 ? "s" : ""}:** ${winners.map(w => `<@${w}>`).join(", ")}`
            : `\n**Winners:** No valid entries — nobody won this one.`;
    } else {
        desc += `\nClick the button below to enter!`;
    }

    embed.setDescription(desc);

    if (giveaway.bannerUrl) embed.setImage(giveaway.bannerUrl);

    return embed;
}

function buildComponents(giveaway, ended = false) {
    if (ended) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("gw_enter")
                .setLabel("Giveaway Ended")
                .setEmoji("🎉")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );
        return [row];
    }
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("gw_enter")
            .setLabel(`Enter (${giveaway.entries.length})`)
            .setEmoji("🎉")
            .setStyle(ButtonStyle.Primary)
    );
    return [row];
}

async function postGiveaway(client, giveaway) {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) throw new Error("Target channel not found or not accessible.");

    const content = pingContent(giveaway.pingType);

    const msg = await channel.send({
        content: content || undefined,
        embeds: [buildEmbed(giveaway, false)],
        components: buildComponents(giveaway, false),
        allowedMentions: allowedMentionsFor(giveaway.pingType),
    });

    giveaway.id = msg.id;
    giveaway.channelId = channel.id;
    giveaway.guildId = channel.guildId;

    active.set(giveaway.id, giveaway);
    saveData();
    scheduleEnd(client, giveaway.id);

    return msg;
}

function scheduleEnd(client, id) {
    const giveaway = active.get(id);
    if (!giveaway || giveaway.ended) return;

    if (timers.has(id)) {
        clearTimeout(timers.get(id));
        timers.delete(id);
    }

    const delay = giveaway.endTime - Date.now();

    // setTimeout max delay is ~24.8 days; re-check every 20 days for very long giveaways
    const MAX_DELAY = 20 * 24 * 60 * 60 * 1000;

    if (delay <= 0) {
        endGiveaway(client, id).catch(err => console.error("[giveaways] auto-end error:", err));
        return;
    }

    const wait = Math.min(delay, MAX_DELAY);
    const handle = setTimeout(() => {
        if (wait < delay) {
            scheduleEnd(client, id); // reschedule remainder
        } else {
            endGiveaway(client, id).catch(err => console.error("[giveaways] auto-end error:", err));
        }
    }, wait);

    timers.set(id, handle);
}

function pickWinners(entries, count) {
    const pool = [...entries];
    const winners = [];
    while (pool.length && winners.length < count) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
    }
    return winners;
}

async function endGiveaway(client, id, opts = {}) {
    const giveaway = active.get(id);
    if (!giveaway) throw new Error("Giveaway not found.");
    if (giveaway.ended && !opts.reroll) throw new Error("This giveaway has already ended.");

    const count = opts.overrideCount || giveaway.winnersCount;
    const winners = pickWinners(giveaway.entries, count);

    giveaway.ended = true;
    giveaway.lastWinners = winners;
    active.set(id, giveaway);
    saveData();

    if (timers.has(id)) {
        clearTimeout(timers.get(id));
        timers.delete(id);
    }

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
        const message = await channel.messages.fetch(giveaway.id).catch(() => null);
        if (message) {
            await message.edit({
                embeds: [buildEmbed(giveaway, true, winners)],
                components: buildComponents(giveaway, true),
            }).catch(() => null);
        }

        if (winners.length) {
            await channel.send({
                content: `🎉 Congratulations ${winners.map(w => `<@${w}>`).join(", ")}! You won **${giveaway.prize}**!`,
                allowedMentions: { users: winners },
            }).catch(() => null);
        } else {
            await channel.send({
                content: `😕 The giveaway for **${giveaway.prize}** ended with no valid entries.`,
            }).catch(() => null);
        }
    }

    return winners;
}

async function rerollGiveaway(client, id, overrideCount) {
    const giveaway = active.get(id);
    if (!giveaway) throw new Error("Giveaway not found.");
    if (!giveaway.ended) throw new Error("You can only reroll a giveaway that has already ended.");

    const count = overrideCount || giveaway.winnersCount;
    const winners = pickWinners(giveaway.entries, count);
    giveaway.lastWinners = winners;
    active.set(id, giveaway);
    saveData();

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
        const message = await channel.messages.fetch(giveaway.id).catch(() => null);
        if (message) {
            await message.edit({ embeds: [buildEmbed(giveaway, true, winners)] }).catch(() => null);
        }
        if (winners.length) {
            await channel.send({
                content: `🔁 New winner${winners.length > 1 ? "s" : ""} for **${giveaway.prize}**: ${winners.map(w => `<@${w}>`).join(", ")}!`,
                allowedMentions: { users: winners },
            }).catch(() => null);
        } else {
            await channel.send({ content: `😕 Couldn't reroll — there are no valid entries.` }).catch(() => null);
        }
    }

    return winners;
}

async function editGiveaway(client, id, updates) {
    const giveaway = active.get(id);
    if (!giveaway) throw new Error("Giveaway not found.");
    if (giveaway.ended) throw new Error("You can't edit a giveaway that has already ended.");

    if (updates.prize !== undefined) giveaway.prize = updates.prize;
    if (updates.winnersCount !== undefined) giveaway.winnersCount = updates.winnersCount;
    if (updates.requirements !== undefined) giveaway.requirements = updates.requirements || null;
    if (updates.bannerUrl !== undefined) giveaway.bannerUrl = updates.bannerUrl || null;
    if (updates.durationMs !== undefined) {
        giveaway.endTime = Date.now() + updates.durationMs;
    }

    active.set(id, giveaway);
    saveData();

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
        const message = await channel.messages.fetch(giveaway.id).catch(() => null);
        if (message) {
            await message.edit({ embeds: [buildEmbed(giveaway, false)] }).catch(() => null);
        }
    }

    if (updates.durationMs !== undefined) scheduleEnd(client, id);

    return giveaway;
}

function toggleEntry(id, userId) {
    const giveaway = active.get(id);
    if (!giveaway) return null;
    if (giveaway.ended) return { giveaway, entered: false, closed: true };

    const idx = giveaway.entries.indexOf(userId);
    let entered;
    if (idx === -1) {
        giveaway.entries.push(userId);
        entered = true;
    } else {
        giveaway.entries.splice(idx, 1);
        entered = false;
    }
    active.set(id, giveaway);
    saveData();
    return { giveaway, entered, closed: false };
}

function getGiveaway(id) {
    return active.get(id) || null;
}

function getActiveByGuild(guildId) {
    return [...active.values()].filter(g => g.guildId === guildId && !g.ended);
}

function init(client) {
    loadData();
    for (const giveaway of active.values()) {
        if (!giveaway.ended) scheduleEnd(client, giveaway.id);
    }
    console.log(`[giveaways] loaded ${active.size} giveaway(s), ${[...active.values()].filter(g => !g.ended).length} active.`);
}

// ---- draft helpers (used while collecting requirements before the giveaway is posted) ----
function createDraft(draftId, data) {
    drafts.set(draftId, data);
    setTimeout(() => drafts.delete(draftId), 10 * 60 * 1000); // expire after 10 min
}
function getDraft(draftId) {
    return drafts.get(draftId) || null;
}
function deleteDraft(draftId) {
    drafts.delete(draftId);
}

module.exports = {
    parseDuration,
    buildEmbed,
    buildComponents,
    postGiveaway,
    endGiveaway,
    rerollGiveaway,
    editGiveaway,
    toggleEntry,
    getGiveaway,
    getActiveByGuild,
    scheduleEnd,
    init,
    createDraft,
    getDraft,
    deleteDraft,
};