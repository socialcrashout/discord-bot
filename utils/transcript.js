'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../ticketConfig.json');

const TRANSCRIPT_DIR = path.join(__dirname, '..', 'data', 'transcripts');
if (!fs.existsSync(TRANSCRIPT_DIR)) fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderMessage(msg) {
  const authorColor = msg.member?.displayHexColor && msg.member.displayHexColor !== '#000000'
    ? msg.member.displayHexColor
    : '#f2f3f5';
  const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
  const timestamp = new Date(msg.createdTimestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  let contentHtml = escapeHtml(msg.content).replace(/\n/g, '<br>');

  const embedsHtml = (msg.embeds || []).map(e => `
    <div class="embed" style="border-left-color:${e.hexColor || '#5865F2'}">
      ${e.author ? `<div class="embed-author">${escapeHtml(e.author.name)}</div>` : ''}
      ${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
      ${e.description ? `<div class="embed-desc">${escapeHtml(e.description).replace(/\n/g, '<br>')}</div>` : ''}
      ${(e.fields || []).length ? `<div class="embed-fields">${e.fields.map(f => `
        <div class="embed-field"><div class="embed-field-name">${escapeHtml(f.name)}</div><div class="embed-field-value">${escapeHtml(f.value).replace(/\n/g, '<br>')}</div></div>
      `).join('')}</div>` : ''}
    </div>
  `).join('');

  const attachmentsHtml = (msg.attachments?.size ? [...msg.attachments.values()] : []).map(a => {
    const isImage = /\.(png|jpe?g|gif|webp)$/i.test(a.name || '');
    return isImage
      ? `<div class="attachment"><img src="${a.url}" alt="${escapeHtml(a.name)}" /></div>`
      : `<div class="attachment file"><a href="${a.url}" target="_blank">📎 ${escapeHtml(a.name)}</a></div>`;
  }).join('');

  const componentsHtml = (msg.components?.length)
    ? `<div class="components">${msg.components.flatMap(row => row.components || []).map(c =>
        `<span class="fake-button">${escapeHtml(c.label || c.placeholder || 'Component')}</span>`
      ).join('')}</div>`
    : '';

  const isSystem = msg.system || msg.author.bot && !msg.content && !msg.embeds?.length;

  return `
    <div class="message ${isSystem ? 'system' : ''}">
      <img class="avatar" src="${avatar}" />
      <div class="message-body">
        <div class="message-header">
          <span class="author" style="color:${authorColor}">${escapeHtml(msg.member?.displayName || msg.author.username)}</span>
          ${msg.author.bot ? '<span class="bot-tag">BOT</span>' : ''}
          <span class="timestamp">${timestamp}</span>
        </div>
        ${contentHtml ? `<div class="content">${contentHtml}</div>` : ''}
        ${embedsHtml}
        ${attachmentsHtml}
        ${componentsHtml}
      </div>
    </div>
  `;
}

function buildTranscriptHtml({ ticket, category, messages, notes, events }) {
  const messagesHtml = messages.map(renderMessage).join('\n');

  const notesHtml = notes.length ? `
    <div class="panel">
      <h3>📝 Internal Staff Notes</h3>
      ${notes.map(n => `<div class="note"><b>&lt;@${n.author_id}&gt;</b> — ${escapeHtml(n.content)} <span class="note-time">${new Date(n.created_at).toLocaleString()}</span></div>`).join('')}
    </div>` : '';

  const eventsHtml = `
    <div class="panel">
      <h3>📜 Audit Log</h3>
      ${events.map(e => `<div class="event">[${new Date(e.created_at).toLocaleString()}] <b>${escapeHtml(e.action)}</b>${e.actor_id ? ` by &lt;@${e.actor_id}&gt;` : ''}${e.detail ? ` — ${escapeHtml(e.detail)}` : ''}</div>`).join('')}
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Transcript — Ticket #${ticket.ticket_number}</title>
<style>
  :root { --bg:#313338; --bg-sidebar:#2b2d31; --text:#f2f3f5; --muted:#949ba4; --accent:${category.color}; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family: 'gg sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  .header { background:var(--bg-sidebar); padding:20px 28px; border-bottom:1px solid #1e1f22; }
  .header h1 { margin:0 0 4px; font-size:20px; }
  .header .meta { color:var(--muted); font-size:13px; }
  .header .badge { display:inline-block; background:var(--accent); color:#111; padding:2px 10px; border-radius:12px; font-size:12px; font-weight:600; margin-right:8px; }
  .messages { padding: 16px 28px; max-width: 900px; margin: 0 auto; }
  .message { display:flex; gap:14px; padding:8px 0; }
  .message.system { opacity:0.7; font-style:italic; }
  .avatar { width:40px; height:40px; border-radius:50%; flex-shrink:0; }
  .message-header { display:flex; align-items:baseline; gap:8px; }
  .author { font-weight:600; }
  .bot-tag { background:#5865F2; color:#fff; font-size:10px; padding:1px 5px; border-radius:4px; font-weight:600; }
  .timestamp { color:var(--muted); font-size:12px; }
  .content { color:#dbdee1; line-height:1.4; margin-top:2px; }
  .embed { border-left:4px solid; background:#2b2d31; border-radius:4px; padding:10px 14px; margin-top:8px; max-width:520px; }
  .embed-author { font-size:12px; font-weight:600; color:var(--muted); }
  .embed-title { font-weight:700; margin:4px 0; }
  .embed-desc { font-size:14px; color:#dbdee1; }
  .embed-fields { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
  .embed-field-name { font-size:12px; font-weight:700; }
  .embed-field-value { font-size:13px; color:#dbdee1; }
  .attachment img { max-width:400px; border-radius:6px; margin-top:8px; }
  .attachment.file a { color:#00a8fc; text-decoration:none; }
  .components { margin-top:8px; }
  .fake-button { display:inline-block; background:#4e5058; padding:4px 12px; border-radius:4px; font-size:13px; margin-right:6px; }
  .panel { max-width:900px; margin: 24px auto; background:var(--bg-sidebar); border-radius:8px; padding:16px 20px; }
  .panel h3 { margin-top:0; }
  .note, .event { font-size:13px; padding:4px 0; border-bottom:1px solid #1e1f22; color:#dbdee1; }
  .note-time, .event { color:var(--muted); }
  .footer { text-align:center; color:var(--muted); font-size:12px; padding:24px; }
</style>
</head>
<body>
  <div class="header">
    <h1>🎫 Ticket #${ticket.ticket_number} — ${escapeHtml(category.label)}</h1>
    <div class="meta">
      <span class="badge">${escapeHtml(ticket.status.toUpperCase())}</span>
      Opened by &lt;@${ticket.opener_id}&gt; • Created ${new Date(ticket.created_at).toLocaleString()}
      ${ticket.closed_at ? ` • Closed ${new Date(ticket.closed_at).toLocaleString()}` : ''}
    </div>
  </div>
  <div class="messages">
    ${messagesHtml || '<p style="color:var(--muted)">No messages recorded.</p>'}
  </div>
  ${notesHtml}
  ${eventsHtml}
  <div class="footer">Generated by ${escapeHtml(config.branding.name)} • ${new Date().toLocaleString()}</div>
</body>
</html>`;
}

async function generateTranscript(channel, ticket, category, notes, events) {
  const fetched = await channel.messages.fetch({ limit: 100 });
  const messages = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const html = buildTranscriptHtml({ ticket, category, messages, notes, events });
  const filePath = path.join(TRANSCRIPT_DIR, `ticket-${ticket.ticket_number}.html`);
  fs.writeFileSync(filePath, html, 'utf8');
  return filePath;
}

module.exports = { generateTranscript, TRANSCRIPT_DIR };