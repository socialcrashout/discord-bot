const fs = require('fs');
const path = require('path');
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} = require('discord.js');

// Hardcoded footer image, shown at the bottom of every sticky message.
const FOOTER_IMAGE = 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw';

const DATA_PATH = path.join(__dirname, '..', 'data', 'sticky.json');

function ensureDataFile() {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2));
}

function loadData() {
    ensureDataFile();
    try {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch (err) {
        console.error('[sticky] failed to read data file:', err);
        return {};
    }
}

function saveData(data) {
    ensureDataFile();
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getSticky(channelId) {
    const data = loadData();
    return data[channelId] || null;
}

function setSticky(channelId, content, messageId = null) {
    const data = loadData();
    data[channelId] = { content, messageId };
    saveData(data);
}

function updateStickyMessageId(channelId, messageId) {
    const data = loadData();
    if (!data[channelId]) return;
    data[channelId].messageId = messageId;
    saveData(data);
}

function removeSticky(channelId) {
    const data = loadData();
    if (!data[channelId]) return false;
    delete data[channelId];
    saveData(data);
    return true;
}

/**
 * Builds the Components V2 container for the sticky message.
 * No accent color is set (leaves the container uncolored, per spec).
 */
function buildStickyContainer(content) {
    const container = new ContainerBuilder();

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content)
    );

    container.addSeparatorComponents(new SeparatorBuilder());

    // Full-width footer image, shown inline (not as a small thumbnail).
    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(FOOTER_IMAGE)
        )
    );

    return container;
}

async function postSticky(channel, content) {
    const container = buildStickyContainer(content);

    const message = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    });

    return message;
}

/**
 * Deletes the previous sticky message (if it still exists) and posts a new
 * one at the bottom of the channel, then saves the new message id.
 */
async function repostSticky(channel) {
    const sticky = getSticky(channel.id);
    if (!sticky) return;

    if (sticky.messageId) {
        try {
            const oldMessage = await channel.messages.fetch(sticky.messageId);
            if (oldMessage) await oldMessage.delete().catch(() => null);
        } catch (err) {
            // Already deleted or inaccessible, ignore.
        }
    }

    try {
        const newMessage = await postSticky(channel, sticky.content);
        updateStickyMessageId(channel.id, newMessage.id);
    } catch (err) {
        console.error('[sticky] failed to repost sticky message:', err);
    }
}

module.exports = {
    FOOTER_IMAGE,
    getSticky,
    setSticky,
    removeSticky,
    updateStickyMessageId,
    buildStickyContainer,
    postSticky,
    repostSticky,
};