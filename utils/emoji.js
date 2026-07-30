/**
 * Turns "<:name:id>" or "<a:name:id>" into the {id, name, animated}
 * object discord.js wants, or just passes unicode emoji straight through.
 */
function parseEmoji(input) {
    if (!input) return null;

    const match = /^<(a)?:(\w+):(\d+)>$/.exec(input.trim());
    if (!match) return input; // unicode emoji, e.g. "🌐"

    const [, animated, name, id] = match;
    return { id, name, animated: Boolean(animated) };
}

module.exports = { parseEmoji };