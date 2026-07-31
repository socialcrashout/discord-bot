/**
 * Small wrapper around the Roblox API calls the donate command needs.
 *
 * Gamepass price updates go through Roblox's official Open Cloud API with
 * an API key. This is the actively-maintained path Roblox itself
 * documents at https://create.roblox.com/docs/cloud/reference/features/game-passes
 * (noblox.js's cookie-based configureGamePass hits a dead/404'ing legacy
 * endpoint as of noblox.js's deprecation in March 2026).
 *
 * T-shirt (classic clothing) price updates still go through noblox.js's
 * configureItem, which uses a different, older endpoint that isn't
 * currently known to be broken.
 */

const noblox = require("noblox.js");
const config = require("../config/donationConfig");

let loggedIn = false;

async function ensureCookieLogin() {
    if (loggedIn) return;

    if (!config.roblox.cookie) {
        throw new Error(
            "ROBLOX_COOKIE is not set in your .env file — can't log in to Roblox."
        );
    }

    await noblox.setCookie(config.roblox.cookie);
    loggedIn = true;
}

// Updates the price of the donation game pass (16+ accounts) via Roblox's
// Open Cloud API, authenticated with an API key (not the cookie).
async function updateGamepassPrice(price) {
    const { universeId, gamepassId, apiKey } = config.roblox;

    if (!apiKey) {
        throw new Error(
            "ROBLOX_API_KEY is not set in your .env file — see create.roblox.com/dashboard/credentials to create one."
        );
    }

    const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${gamepassId}`;

    console.log(`[roblox] PATCH ${url}`);

    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ price, isForSale: true }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(`[roblox] gamepass update failed - status ${response.status}, content-type: ${response.headers.get("content-type")}`);
        console.error(`[roblox] response body: ${text}`);
        throw new Error(`Roblox API error (${response.status}): ${text}`);
    }

    return response.json().catch(() => ({}));
}

// Updates the price of the donation t-shirt (under 16 accounts) via
// noblox.js's cookie-based configureItem.
async function updateTshirtPrice(price) {
    await ensureCookieLogin();

    const assetId = Number(config.roblox.tshirtId);
    const info = await noblox.getProductInfo(assetId);

    return noblox.configureItem(assetId, info.Name, info.Description, false, price);
}

module.exports = { updateGamepassPrice, updateTshirtPrice };