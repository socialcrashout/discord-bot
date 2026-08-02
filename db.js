require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

let db;

async function connectDB() {
    if (db) return db; // already connected
    await client.connect();
    db = client.db("lorenzo"); // pick any db name you like
    console.log("Connected to MongoDB");
    return db;
}

function getDB() {
    if (!db) throw new Error("Database not connected yet — call connectDB() first.");
    return db;
}

module.exports = { connectDB, getDB };