const fs = require("fs");
const path = require("path");

function escapeHtml(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Very lightweight discord-markdown -> html (bold/italics/code/links/mentions).
// Not exhaustive on purpose - transcripts just need to be readable.
function renderContent(content = "") {
    let out = escapeHtml(content);
    out = out.replace(/```([\s\S]*?)```/g, (_, code) => `<pre>${code}</pre>`);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/\*(.+?)\*/g, "<em>$1</em>");
    out = out.replace(/~~(.+?)~~/g, "<s>$1</s>");
    out = out.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    out = out.replace(/\n/g, "<br>");
    return out;
}

/**
 * Fetches every message in a text channel, oldest -> newest.
 */
async function fetchAllMessages(channel) {
    const all = [];
    let lastId;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const batch = await channel.messages.fetch(options);
        if (batch.size === 0) break;

        all.push(...batch.values());
        lastId = batch.last().id;

        if (batch.size < 100) break;
    }

    return all.reverse(); // oldest first
}

/**
 * Generates an HTML transcript for a channel and saves it to /transcripts.
 * Returns { filePath, fileName }.
 */
async function generateTranscript(channel) {
    const messages = await fetchAllMessages(channel);

    const rows = messages
        .map((m) => {
            const avatar = m.author.displayAvatarURL({ extension: "png", size: 64 });
            const name = escapeHtml(m.member?.displayName || m.author.username);
            const time = new Date(m.createdTimestamp).toLocaleString();
            const body = renderContent(m.content);

            const attachments = [...m.attachments.values()]
                .map((a) => {
                    if (/\.(png|jpe?g|gif|webp)$/i.test(a.name || "")) {
                        return `<div class="attachment"><img src="${a.url}" alt="${escapeHtml(a.name)}"></div>`;
                    }
                    return `<div class="attachment"><a href="${a.url}" target="_blank" rel="noopener">📎 ${escapeHtml(a.name)}</a></div>`;
                })
                .join("");

            return `
      <div class="message">
        <img class="avatar" src="${avatar}" alt="">
        <div class="content">
          <div class="meta"><span class="author">${name}</span><span class="time">${time}</span></div>
          <div class="body">${body}</div>
          ${attachments}
        </div>
      </div>`;
        })
        .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Transcript - ${escapeHtml(channel.name)}</title>
<style>
  body { background:#313338; color:#dbdee1; font-family: "gg sans", "Helvetica Neue", Arial, sans-serif; margin:0; padding:24px; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#949ba4; font-size:13px; margin-bottom:24px; }
  .message { display:flex; gap:16px; padding:8px 0; }
  .avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; }
  .meta { display:flex; align-items:baseline; gap:8px; }
  .author { font-weight:600; color:#f2f3f5; }
  .time { font-size:12px; color:#949ba4; }
  .body { white-space:pre-wrap; line-height:1.4; margin-top:2px; }
  code { background:#2b2d31; padding:1px 4px; border-radius:4px; }
  pre { background:#2b2d31; padding:10px; border-radius:6px; overflow-x:auto; }
  a { color:#00a8fc; }
  .attachment img { max-width:400px; border-radius:6px; margin-top:6px; display:block; }
  .attachment a { display:inline-block; margin-top:6px; }
</style>
</head>
<body>
  <h1>#${escapeHtml(channel.name)}</h1>
  <div class="sub">${messages.length} messages · generated ${new Date().toLocaleString()}</div>
  ${rows || '<div class="sub">No messages.</div>'}
</body>
</html>`;

    const dir = path.join(__dirname, "..", "transcripts");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const fileName = `${channel.name}-${Date.now()}.html`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, html, "utf-8");

    return { filePath, fileName };
}

module.exports = { generateTranscript };