const fs = require("fs");
const path = require("path");
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MessageFlags,
} = require("discord.js");

const DATA_PATH = path.join(__dirname, "..", "data", "giveaways.json");
const CONFIG = {
    BANNER_URL: "https://yumi.onl/api/files/6a6a214a66bfddd463dffa7c/raw",
    FOOTER_URL: "https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw",
    EMOJIS: {
        title: "<:confetti:1502514534298943509>",     // shown next to the prize in the title line
        enter: "<:Star:1531882389062684792>",     // shown on the "Enter" button
        ended: "<:Lock:1502513716384632873>",     // shown on the disabled "Ended" button
        entries: "<:Member:1502514198595240076>",   // shown next to the entries count
        duration: "<:Calendar:1502513561866473734>",  // shown next to duration / ends-at
        winner: "<:cheers:1502514532331946006>",    // shown next to winner(s)
    },

    TEXT: {
        titleLine: "{titleEmoji} **{prize}**",
        idLine: "Giveaway ID: {id}",
        durationLineActive: "{durationEmoji} **Duration:** <t:{endTimestamp}:R>",
        durationLineEnded: "{durationEmoji} **Duration:** Ended",
        entriesLine: "{entriesEmoji} **Entries:** {entryCount}",
        winnerCountLine: "{winnerEmoji} **Winner Count:** {winnersCount}",
        winnersLineEnded: "{winnerEmoji} **Winners:** {winnersMentions}",
        noWinnersLine: "{winnerEmoji} **Winners:** No valid entries",
        requirementsLine: "**Requirements:**\n{requirements}",
        idLine: "<:Save:1502514208019972217> **Giveaway ID:** {id}",
        enterCallToAction: "Click the button below to enter!",
        announceWin: "{titleEmoji} Congratulations {winnersMentions} on winning **{prize}**!",
        announceNoWinners: "😕 The giveaway for **{prize}** ended with no valid entries.",
        rerollAnnounce: "🔁 New winner{plural} for **{prize}**: {winnersMentions}!",
        rerollNoWinners: "😕 Couldn't reroll — there are no valid entries.",
    },

    BUTTONS: {
        enterLabel: "Enter Giveaway",
        endedLabel: "Ended",
        entriesLabelSuffix: "Entries", // secondary button reads "{count} Entries"
    },
};
const active = new Map();   // id -> giveaway object
const timers = new Map();   // id -> Timeout handle
const drafts = new Map();   // draftId -> in-progress giveaway builder (pre-post)

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

// tiny {placeholder} renderer so CONFIG.TEXT stays plain, editable strings
function render(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ""));
}
function buildGiveawayContainer(giveaway, ended = false, winners = []) {
    const { EMOJIS, TEXT } = CONFIG;
    const endTimestamp = Math.floor(giveaway.endTime / 1000);
    const container = new ContainerBuilder();

    // Banner
    if (CONFIG.BANNER_URL) {
        container.addMediaGalleryComponents((gallery) =>
            gallery.addItems((item) => item.setURL(CONFIG.BANNER_URL))
        );
    }

    // Title
    container.addTextDisplayComponents((t) =>
        t.setContent(render(TEXT.titleLine, { titleEmoji: EMOJIS.title, prize: giveaway.prize }))
    );

    // Ping tag, if any
    const ping = pingContent(giveaway.pingType);
    if (ping) {
        container.addTextDisplayComponents((t) => t.setContent(ping));
    }

    // Giveaway ID
    container.addTextDisplayComponents((t) =>
        t.setContent(render(TEXT.idLine, { id: giveaway.id || "pending" }))
    );

    container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    // Info block
    const lines = [];
    lines.push(
        ended
            ? render(TEXT.durationLineEnded, { durationEmoji: EMOJIS.duration })
            : render(TEXT.durationLineActive, { durationEmoji: EMOJIS.duration, endTimestamp })
    );
    lines.push(render(TEXT.entriesLine, { entriesEmoji: EMOJIS.entries, entryCount: giveaway.entries.length }));

    if (ended) {
        lines.push(
            winners.length
                ? render(TEXT.winnersLineEnded, {
                      winnerEmoji: EMOJIS.winner,
                      winnersMentions: winners.map((w) => `<@${w}>`).join(", "),
                  })
                : render(TEXT.noWinnersLine, { winnerEmoji: EMOJIS.winner })
        );
    } else {
        lines.push(render(TEXT.winnerCountLine, { winnerEmoji: EMOJIS.winner, winnersCount: giveaway.winnersCount }));
    }

    if (giveaway.requirements) {
        lines.push("");
        lines.push(render(TEXT.requirementsLine, { requirements: giveaway.requirements }));
    }

    if (!ended) {
        lines.push("");
        lines.push(TEXT.enterCallToAction);
    }

    container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));

    // Buttons
    container.addActionRowComponents((row) => row.setComponents(buildButtons(giveaway, ended)));

    // Footer (hardcoded image, shown at the very bottom of the container)
    if (CONFIG.FOOTER_URL) {
        container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        container.addMediaGalleryComponents((gallery) =>
            gallery.addItems((item) => item.setURL(CONFIG.FOOTER_URL))
        );
    }

    return container;
}

function buildButtons(giveaway, ended = false) {
    const { EMOJIS, BUTTONS } = CONFIG;

    const enterButton = new ButtonBuilder()
        .setCustomId("gw_enter")
        .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setLabel(ended ? BUTTONS.endedLabel : BUTTONS.enterLabel)
        .setEmoji(ended ? EMOJIS.ended : EMOJIS.enter)
        .setDisabled(ended);

    const entriesButton = new ButtonBuilder()
        .setCustomId("gw_entries_count")
        .setStyle(ButtonStyle.Secondary)
        .setLabel(`${giveaway.entries.length} ${BUTTONS.entriesLabelSuffix}`)
        .setEmoji(EMOJIS.entries)
        .setDisabled(true);

    return [enterButton, entriesButton];
}

// Wraps a container in the payload shape needed to actually send/edit it.
function containerPayload(container, extra = {}) {
    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        ...extra,
    };
}

async function postGiveaway(client, giveaway) {
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (!channel) throw new Error("Target channel not found or not accessible.");

    // Components V2 messages can't carry `content`, so an @everyone/@here
    // ping (if configured) goes out as its own plain message right before
    // the giveaway container.
    const ping = pingContent(giveaway.pingType);
    if (ping) {
        await channel.send({
            content: ping,
            allowedMentions: allowedMentionsFor(giveaway.pingType),
        }).catch(() => null);
    }

    const msg = await channel.send(
        containerPayload(buildGiveawayContainer(giveaway, false))
    );

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
            await message.edit(
                containerPayload(buildGiveawayContainer(giveaway, true, winners))
            ).catch(() => null);

            // Announcement replies to the original giveaway message so it's
            // obvious which giveaway it belongs to.
            const announceContainer = new ContainerBuilder().addTextDisplayComponents((t) =>
                t.setContent(
                    winners.length
                        ? render(CONFIG.TEXT.announceWin, {
                              titleEmoji: CONFIG.EMOJIS.title,
                              winnersMentions: winners.map((w) => `<@${w}>`).join(", "),
                              prize: giveaway.prize,
                          })
                        : render(CONFIG.TEXT.announceNoWinners, { prize: giveaway.prize })
                )
            );

            await message.reply(
                containerPayload(announceContainer, {
                    allowedMentions: { users: winners },
                })
            ).catch(() => null);
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
            await message.edit(
                containerPayload(buildGiveawayContainer(giveaway, true, winners))
            ).catch(() => null);

            const rerollContainer = new ContainerBuilder().addTextDisplayComponents((t) =>
                t.setContent(
                    winners.length
                        ? render(CONFIG.TEXT.rerollAnnounce, {
                              plural: winners.length > 1 ? "s" : "",
                              prize: giveaway.prize,
                              winnersMentions: winners.map((w) => `<@${w}>`).join(", "),
                          })
                        : CONFIG.TEXT.rerollNoWinners
                )
            );

            await message.reply(
                containerPayload(rerollContainer, {
                    allowedMentions: { users: winners },
                })
            ).catch(() => null);
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
    if (updates.durationMs !== undefined) {
        giveaway.endTime = Date.now() + updates.durationMs;
    }

    active.set(id, giveaway);
    saveData();

    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel) {
        const message = await channel.messages.fetch(giveaway.id).catch(() => null);
        if (message) {
            await message.edit(
                containerPayload(buildGiveawayContainer(giveaway, false))
            ).catch(() => null);
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
    CONFIG,
    parseDuration,
    buildGiveawayContainer,
    buildButtons,
    containerPayload,
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