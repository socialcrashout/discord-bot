/**
 * Everything the /donate command needs to know.
 * Edit this file (and your .env) to configure it — you shouldn't need to
 * touch commands/donate.js or utils/donationManager.js at all.
 */

module.exports = {
    // Channel the "someone just donated!" message gets posted in.
    // Used for BOTH Robux and USD donations.
    appreciationChannelId: "1502517147673563266",

    roblox: {
        // The .ROBLOSECURITY cookie for the account that owns the game pass
        // and t-shirt below. Put this in your .env as ROBLOX_COOKIE=... —
        // never hardcode it here.
        cookie: process.env.ROBLOX_COOKIE || "",

        // The universe (game) ID that owns the donation game pass.
        // Find it via the Creator Dashboard URL for your experience.
        universeId: "10151034895",

        // Asset used for accounts 16+ (game passes can be any price).
        gamepassId: "1893046976",

        // Asset used for accounts under 16 (game passes are hidden for
        // under-13s/restricted accounts, t-shirts still work).
        tshirtId: "PUT_TSHIRT_ID_HERE",

        // Robux amounts shown in the dropdown. Add/remove/edit freely.
        priceOptions: [50, 100, 250, 500, 1000, 2500, 5000],
    },

    usd: {
        kofiUrl: "https://ko-fi.com/yourname",
        cashappUrl: "https://cash.app/$yourname",
    },

    // Custom emoji shown in the appreciation message header.
    moneyEmoji: "<:money:1502514540687003668>",

    // Tweak the wording of the appreciation messages here.
    messages: {
        robuxAppreciation: (userMention, amount) =>
            `**<:money:1502514540687003668>  Thank You for Donating!**\nA big shoutout to ${userMention} for donating **${amount} Robux**! We truly appreciate your generosity and support; it really helps us grow and improve the community. Thank you so much!`,
        usdAppreciation: (userMention, amount) =>
            `**<:money:1502514540687003668>  Thank You for Donating!**\nA big shoutout to ${userMention} for donating **$${amount}**! We truly appreciate your generosity and support; it really helps us grow and improve the community. Thank you so much!`,
    },
};