const fs = require('node:fs/promises');
const path = require('node:path');

const file = path.resolve('data/tickets.json');
async function read() { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return { nextNumber: 1, tickets: {} }; } }
async function write(data) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data, null, 2)); }

async function nextTicketNumber() { const data = await read(); const n = data.nextNumber++; await write(data); return n; }
async function saveTicket(ticket) { const data = await read(); data.tickets[ticket.channelId] = ticket; await write(data); }
async function getTicket(channelId) { return (await read()).tickets[channelId] ?? null; }
async function removeTicket(channelId) { const data = await read(); delete data.tickets[channelId]; await write(data); }
async function openTickets() { return Object.values((await read()).tickets); }
module.exports = { nextTicketNumber, saveTicket, getTicket, removeTicket, openTickets };
