const noblox = require('noblox.js');
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MessageFlags,
} = require('discord.js');
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

// ------------------------- CONFIG -------------------------

const GROUP_ID = process.env.GROUP_ID;
const LOG_CHANNEL_ID = '1502790208020545536';

const DOCK_API_KEY = process.env.DOCK_API_KEY;
const DOCK_BASE_URL = 'https://api.docksys.xyz';
const DISCORD_SERVER_ID = '1502510812441608222';

const PROXY_URL = 'http://180.183.157.159:8080';
const PROXY_AGENT = new HttpsProxyAgent(PROXY_URL);

const POLL_INTERVAL_MS = 20_000;   // how often we check for new transactions
const QUEUE_DELAY_MS = 5_000;      // spacing between processed jobs
const RATE_LIMIT_COOLDOWN_MS = 60_000;

// ------------------------- STATE -------------------------

const queue = [];
let isProcessing = false;
let latestTransactionDate = new Date();

// ------------------------- HELPERS -------------------------

/**
 * Resolves a Roblox user ID to a Discord user ID via the Dock API.
 * Returns null if no link is found, the key is missing, or the lookup fails.
 * Docs: https://docs.docksys.xyz/api-reference/map-roblox-id-to-discord-ids
 */
async function getDiscordIdFromDock(robloxId) {
    if (!DOCK_API_KEY) return null;

    const url = `${DOCK_BASE_URL}/api/v1/public/roblox-to-discord?robloxId=${robloxId}&guildId=${DISCORD_SERVER_ID}`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${DOCK_API_KEY}` },
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 429) {
                console.warn(`[Dock] Rate limited. Retry after ${data.retryAfter ?? '?'}s.`);
            } else {
                console.warn(`[Dock] Lookup failed (${response.status}): ${data.error ?? 'Unknown error'}`);
            }
            return null;
        }

        return data.data?.discordIds?.[0] ?? null;
    } catch (error) {
        console.error('[Dock] Failed to resolve Discord ID:', error.message);
        return null;
    }
}

/**
 * Builds the Components V2 container message for a single transaction.
 * No accent color is set (setAccentColor is intentionally omitted).
 */
function buildPurchaseContainer({ itemName, purchasedLink, buyerMention, discordMention, price, unixTimestamp }) {
    const lines = [
        '## Purchase Log',
        `**Username:** ${buyerMention}`,
        `**Discord:** ${discordMention}`,
        `**Purchased:** ${purchasedLink ? `[${itemName}](${purchasedLink})` : itemName}`,
        `**Amount After Tax:** R$${price}`,
        `**Date Purchased:** <t:${unixTimestamp}:R>`,
    ].join('\n');

    return new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
        .addSeparatorComponents(new SeparatorBuilder());
}

// ------------------------- CORE LOGIC -------------------------

async function sendPurchaseLog(client, transaction) {
    const itemName = transaction.details?.name || 'Unknown Item';
    const itemId = transaction.details?.id;
    const purchasedLink = itemId ? `https://www.roblox.com/catalog/${itemId}` : null;

    const buyerId = transaction.agent?.id || 'Unknown';
    const buyerName = transaction.agent?.name || 'Unknown';
    const buyerMention = `[${buyerName}](https://www.roblox.com/users/${buyerId}/profile)`;

    const price = transaction.currency?.amount ?? 0;
    const unixTimestamp = Math.floor(new Date(transaction.created).getTime() / 1000);

    const discordId = await getDiscordIdFromDock(buyerId);
    const discordMention = discordId ? `<@${discordId}>` : 'Not linked';

    const container = buildPurchaseContainer({
        itemName,
        purchasedLink,
        buyerMention,
        discordMention,
        price,
        unixTimestamp,
    });

    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) {
            console.error('[PurchaseLog] Log channel not found.');
            return;
        }

        await channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (error) {
        console.error('[PurchaseLog] Failed to send container message:', error.message);
    }
}

async function checkForNewTransactions(client) {
    try {
        const transactions = await noblox.getGroupTransactions(GROUP_ID, 'Sale', {
            agent: PROXY_AGENT,
        });

        // Process oldest -> newest so ordering (and timestamp tracking) stays correct
        const newTransactions = transactions
            .filter((t) => new Date(t.created) > latestTransactionDate)
            .sort((a, b) => new Date(a.created) - new Date(b.created));

        for (const transaction of newTransactions) {
            await sendPurchaseLog(client, transaction);
            latestTransactionDate = new Date(transaction.created);
        }
    } catch (error) {
        if (error.message?.includes('429')) {
            console.log('[PurchaseLog] Rate limited, cooling down...');
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_COOLDOWN_MS));
        } else {
            console.error('[PurchaseLog] Failed to fetch transactions:', error.message);
        }
    }
}

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (queue.length > 0) {
        const job = queue.shift();
        await job();
        await new Promise((resolve) => setTimeout(resolve, QUEUE_DELAY_MS));
    }

    isProcessing = false;
}

function listenForPurchases(client) {
    setInterval(() => {
        queue.push(() => checkForNewTransactions(client));
        processQueue();
    }, POLL_INTERVAL_MS);
}

// ------------------------- ENTRY POINT -------------------------

module.exports = {
    name: 'ready',
    once: true,
    execute: async (client) => {
        if (!GROUP_ID) {
            client.logs.error('GROUP_ID is missing from the environment.');
            return;
        }

        try {
            await noblox.setCookie(process.env.COOKIE);
            client.logs.custom('Purchase logging started.');
            listenForPurchases(client);
        } catch (error) {
            client.logs.error('Failed to start purchase logging:', error.message);
        }
    },
};