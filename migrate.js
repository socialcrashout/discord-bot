require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { connectDB } = require('./db');

async function migrate() {
    const db = await connectDB();
    const dataDir = path.join(__dirname, 'data');

    const arrayFiles = ['reviews.json', 'cases.json', 'warnings.json'];
    for (const file of arrayFiles) {
        const filePath = path.join(dataDir, file);
        if (!fs.existsSync(filePath)) continue;
        const arr = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (arr.length === 0) continue;
        const collectionName = file.replace('.json', '');
        await db.collection(collectionName).insertMany(arr);
        console.log(`Migrated ${arr.length} docs into ${collectionName}`);
    }

    process.exit(0);
}

migrate();