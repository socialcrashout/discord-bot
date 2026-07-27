const { SlashCommandBuilder } = require('discord.js');
const { panelPayload } = require('../ticketSystem');
module.exports = { data: new SlashCommandBuilder().setName('ticketpanel').setDescription('Post the ticket panel'), execute: (interaction) => interaction.reply(panelPayload()) };