require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB } = require('./db');

async function migrate() {
    const db = await connectDB();
    const dataDir = path.join(__dirname, 'data');

    // ── reviews.json — plain array ──────────────────────────
    const reviewsPath = path.join(dataDir, 'reviews.json');
    if (fs.existsSync(reviewsPath)) {
        const arr = JSON.parse(fs.readFileSync(reviewsPath, 'utf8'));
        if (arr.length > 0) {
            await db.collection('reviews').insertMany(arr);
            console.log(`Migrated ${arr.length} docs into reviews`);
        } else {
            console.log('Skipped reviews.json — empty');
        }
    }

    // ── warnings.json — { guildId: [...entries] } ───────────
    const warningsPath = path.join(dataDir, 'warnings.json');
    if (fs.existsSync(warningsPath)) {
        const raw = JSON.parse(fs.readFileSync(warningsPath, 'utf8'));
        const flatDocs = [];
        for (const [guildId, entries] of Object.entries(raw)) {
            for (const entry of entries) {
                flatDocs.push({ guildId, ...entry });
            }
        }
        if (flatDocs.length > 0) {
            await db.collection('warnings').insertMany(flatDocs);
            console.log(`Migrated ${flatDocs.length} warning/mod-log entries`);
        } else {
            console.log('Skipped warnings.json — empty');
        }
    }

    // ── cases.json — { guildId: lastCaseNumber } ────────────
    const casesPath = path.join(dataDir, 'cases.json');
    if (fs.existsSync(casesPath)) {
        const raw = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
        const entries = Object.entries(raw);
        for (const [guildId, count] of entries) {
            await db.collection('caseCounters').updateOne(
                { _id: guildId },
                { $set: { count } },
                { upsert: true }
            );
        }
        console.log(`Migrated ${entries.length} case counters`);
    }

    // ── serverLock.json — { guildId: { channelId: value } } ─
    const serverLockPath = path.join(dataDir, 'serverLock.json');
    if (fs.existsSync(serverLockPath)) {
        const raw = JSON.parse(fs.readFileSync(serverLockPath, 'utf8'));
        const entries = Object.entries(raw);
        for (const [guildId, channelStates] of entries) {
            await db.collection('serverLock').updateOne(
                { _id: guildId },
                { $set: { channelStates } },
                { upsert: true }
            );
        }
        console.log(`Migrated ${entries.length} server lock states`);
    }

    // ── channelLock.json — { channelId: value } ─────────────
    const channelLockPath = path.join(dataDir, 'channelLock.json');
    if (fs.existsSync(channelLockPath)) {
        const raw = JSON.parse(fs.readFileSync(channelLockPath, 'utf8'));
        const entries = Object.entries(raw);
        for (const [channelId, value] of entries) {
            await db.collection('channelLock').updateOne(
                { _id: channelId },
                { $set: { value } },
                { upsert: true }
            );
        }
        console.log(`Migrated ${entries.length} channel lock states`);
    }

    // ── ticketCount.json — { count: N } ──────────────────────
    const ticketCountPath = path.join(dataDir, 'ticketCount.json');
    if (fs.existsSync(ticketCountPath)) {
        const raw = JSON.parse(fs.readFileSync(ticketCountPath, 'utf8'));
        await db.collection('ticketCounters').updateOne(
            { _id: 'global' },
            { $set: { count: raw.count || 0 } },
            { upsert: true }
        );
        console.log(`Migrated ticket counter (count: ${raw.count || 0})`);
    }

    // ── sticky.json — { channelId: { content, messageId } } ─
    const stickyPath = path.join(dataDir, 'sticky.json');
    if (fs.existsSync(stickyPath)) {
        const raw = JSON.parse(fs.readFileSync(stickyPath, 'utf8'));
        const entries = Object.entries(raw);
        for (const [channelId, val] of entries) {
            await db.collection('sticky').updateOne(
                { _id: channelId },
                { $set: { content: val.content, messageId: val.messageId } },
                { upsert: true }
            );
        }
        console.log(`Migrated ${entries.length} sticky messages`);
    }

    console.log('Migration complete.');
    process.exit(0);
}

migrate();
// ── memberStats.json — { history: [...] } ───────────────
const memberStatsPath = path.join(dataDir, 'memberStats.json');
if (fs.existsSync(memberStatsPath)) {
    const raw = JSON.parse(fs.readFileSync(memberStatsPath, 'utf8'));
    const history = raw.history || [];
    if (history.length > 0) {
        await db.collection('memberStats').insertMany(history);
        console.log(`Migrated ${history.length} member stat entries`);
    } else {
        console.log('Skipped memberStats.json — empty history');
    }
}