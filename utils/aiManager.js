// utils/aiManager.js
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const BOT_NAME = 'Lorenzo from .mode';
const BRAND_NAME = '.mode';

const SERVICES_LIST = `• Professional Server Setups
- Livery & ELS Design
- Clothing Design
- Graphic Design
- Discord & Bot Development
- Professional Document Designs
- Nitro, Boosts, and decors`;

const SYSTEM_PROMPT = `You are ${BOT_NAME}, the AI assistant for ${BRAND_NAME}, a Discord community.
Here's what we offer:
${SERVICES_LIST}

Answer questions about these services, general questions about the server, and casual conversation.
Keep responses clear and reasonably concise (this is a chat app, not an essay). If someone asks about 
one of our services, feel free to mention the relevant offering and encourage them to ask for more details.`;

const INTRO_MESSAGE = `Hey there! I'm ${BOT_NAME}, here to help out around ${BRAND_NAME}. ` +
  `Got a question about what we offer — or just want to chat? Go ahead and ask, I'm all ears.`;

const conversations = new Map();

async function getAIResponse(channelId, userMessage) {
    const history = conversations.get(channelId) || [];
    history.push({ role: 'user', content: userMessage });

    const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 800,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
        ],
    });

    const reply = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: reply });

    if (history.length > 10) history.splice(0, history.length - 10);
    conversations.set(channelId, history);

    return reply;
}

function isFirstTouch(channelId) {
    return !conversations.has(channelId);
}

function seedIntro(channelId, userMessage) {
    conversations.set(channelId, [
        { role: 'user', content: userMessage || 'hi' },
        { role: 'assistant', content: INTRO_MESSAGE },
    ]);
}

module.exports = {
    getAIResponse,
    isFirstTouch,
    seedIntro,
    INTRO_MESSAGE,
};