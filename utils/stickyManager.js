const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} = require('discord.js');
const { getDB } = require('../db');

// Hardcoded footer image, shown at the bottom of every sticky message.
const FOOTER_IMAGE = 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw';

async function getSticky(channelId) {
    const db = getDB();
    const doc = await db.collection('sticky').findOne({ _id: channelId });
    if (!doc) return null;
    return { content: doc.content, messageId: doc.messageId };
}

async function setSticky(channelId, content, messageId = null) {
    const db = getDB();
    await db.collection('sticky').updateOne(
        { _id: channelId },
        { $set: { content, messageId } },
        { upsert: true }
    );
}

async function updateStickyMessageId(channelId, messageId) {
    const db = getDB();
    await db.collection('sticky').updateOne(
        { _id: channelId },
        { $set: { messageId } }
    );
}

async function removeSticky(channelId) {
    const db = getDB();
    const result = await db.collection('sticky').deleteOne({ _id: channelId });
    return result.deletedCount > 0;
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
    const sticky = await getSticky(channel.id);
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
        await updateStickyMessageId(channel.id, newMessage.id);
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