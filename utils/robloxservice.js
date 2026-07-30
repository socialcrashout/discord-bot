/**
 * Small wrapper around the Roblox API calls the donate command needs.
 *
 * This uses noblox.js's own built-in functions (configureGamePass /
 * configureItem) instead of hand-rolled HTTP requests. noblox.js maintains
 * these against Roblox's actual (undocumented, form-data based) endpoints,
 * which is much more reliable than guessing the request shape ourselves.
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

// Updates the price of the donation game pass (16+ accounts).
// Passing "" for name/description tells noblox.js to leave those alone
// and only touch the price.
async function updateGamepassPrice(price) {
    await ensureLogin();

    const gamePassId = Number(config.roblox.gamepassId);
    return noblox.configureGamePass(gamePassId, "", "", price);
}

// Updates the price of the donation t-shirt (under 16 accounts).
// Unlike configureGamePass, configureItem requires name/description to be
// passed every time, so we fetch the current ones first and pass them
// straight back through unchanged.
async function updateTshirtPrice(price) {
    await ensureLogin();

    const assetId = Number(config.roblox.tshirtId);
    const info = await noblox.getProductInfo(assetId);

    return noblox.configureItem(assetId, info.Name, info.Description, false, price);
}

module.exports = { updateGamepassPrice, updateTshirtPrice };