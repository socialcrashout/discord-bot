/**
 * Small wrapper around the Roblox API calls the donate command needs.
 *
 * Roblox's price-update endpoints are Open Cloud "Beta" endpoints and can
 * change their exact request body over time. If updatePrice() ever starts
 * failing after Roblox pushes an update on their end, the fastest fix is:
 *   1. Open the Creator Dashboard, open your gamepass/t-shirt settings.
 *   2. Open devtools -> Network tab, change the price manually.
 *   3. Compare the request body Roblox sends to the one built below and
 *      adjust sendAuthenticatedPatch()'s body accordingly.
 */

const noblox = require("noblox.js");
const config = require("../config/donationConfig");

let loggedIn = false;

async function ensureLogin() {
    if (loggedIn) return;

    if (!config.roblox.cookie) {
        throw new Error(
            "ROBLOX_COOKIE is not set in your .env file — can't log in to Roblox."
        );
    }

    await noblox.setCookie(config.roblox.cookie);
    loggedIn = true;
}

async function sendAuthenticatedPatch(url, body) {
    const cookie = config.roblox.cookie;
    const headers = {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json",
    };

    console.log(`[roblox] PATCH ${url}`);
    console.log(`[roblox] body: ${JSON.stringify(body)}`);

    // Roblox rejects the first write request and hands back the CSRF
    // token it wants in the retry — this is the standard dance.
    const probe = await fetch(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
    });

    const csrfToken = probe.headers.get("x-csrf-token");

    if (!csrfToken) {
        // Some accounts/endpoints succeed on the first try with no CSRF
        // challenge — treat that as success instead of erroring out.
        if (probe.ok) return probe.json().catch(() => ({}));
        const text = await probe.text().catch(() => "");
        console.error(`[roblox] probe failed - status ${probe.status}, content-type: ${probe.headers.get("content-type")}`);
        console.error(`[roblox] probe response body: ${text}`);
        throw new Error(`Roblox API error (${probe.status}): ${text}`);
    }

    const response = await fetch(url, {
        method: "PATCH",
        headers: { ...headers, "X-CSRF-TOKEN": csrfToken },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        console.error(`[roblox] request failed - status ${response.status}, content-type: ${response.headers.get("content-type")}`);
        console.error(`[roblox] response body: ${text}`);
        throw new Error(`Roblox API error (${response.status}): ${text}`);
    }

    return response.json().catch(() => ({}));
}

// Updates the price of the donation game pass (16+ accounts).
async function updateGamepassPrice(price) {
    await ensureLogin();

    const { universeId, gamepassId } = config.roblox;
    const url = `https://apis.roblox.com/game-passes/v1/universes/${universeId}/game-passes/${gamepassId}`;

    return sendAuthenticatedPatch(url, {
        price,
        isForSale: true,
    });
}

// Updates the price of the donation t-shirt (under 16 accounts).
// Classic-asset pricing is less consistently documented than game passes —
// test this once with a small price before relying on it live.
async function updateTshirtPrice(price) {
    await ensureLogin();

    const { tshirtId } = config.roblox;
    const url = `https://itemconfiguration.roblox.com/v1/assets/${tshirtId}/update`;

    return sendAuthenticatedPatch(url, {
        Price: price,
        IsForSale: true,
    });
}

module.exports = { updateGamepassPrice, updateTshirtPrice };