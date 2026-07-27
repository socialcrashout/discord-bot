require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { handleTicketButton, createTicket, closeTicket, handleUserModal } = require('./ticketSystem');
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, PREFIX = '-' } = process.env;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences] });
client.commands = new Collection();
client.slashCommands = new Collection();

function load(file) { try { delete require.cache[require.resolve(file)]; return require(file); } catch (error) { console.error(`Could not load ${file}`, error); return null; } }
function loadPrefixCommands() { client.commands.clear(); const dir = path.join(__dirname, 'prefix'); if (!fs.existsSync(dir)) return; for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) { const command = load(path.join(dir, file)); if (command?.name && command.execute) client.commands.set(command.name, command); } }
function loadSlashCommands() { client.slashCommands.clear(); const dir = path.join(__dirname, 'commands'); if (!fs.existsSync(dir)) return []; const data = []; for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) { const command = load(path.join(dir, file)); if (command?.data && command.execute) { client.slashCommands.set(command.data.name, command); data.push(command.data.toJSON()); } } return data; }
function loadEvents() { const dir = path.join(__dirname, 'events'); if (!fs.existsSync(dir)) return; for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) { const event = load(path.join(dir, file)); if (!event?.name || !event.execute) continue; (event.once ? client.once : client.on).call(client, event.name, (...args) => event.execute(...args, client)); } }
async function deploySlashCommands() { if (!DISCORD_TOKEN || !CLIENT_ID) return console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env'); const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID); await new REST({ version: '10' }).setToken(DISCORD_TOKEN).put(route, { body: loadSlashCommands() }); console.log('Slash commands deployed.'); }

loadPrefixCommands(); loadSlashCommands(); loadEvents(); deploySlashCommands().catch(console.error);
client.once(Events.ClientReady, (ready) => console.log(`Logged in as ${ready.user.tag}`));

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/); const command = client.commands.get(args.shift().toLowerCase());
  if (!command) return;
  try { await command.execute(message, args, client); } catch (error) { console.error('Prefix command error:', error); await message.reply('There was an error executing that command.').catch(() => {}); }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // These must run before the slash-command check: buttons and modals are ticket interactions.
    if (interaction.isButton() && interaction.customId.startsWith('ticket:')) return handleTicketButton(interaction);
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ticket:details:')) return createTicket(interaction, interaction.customId.split(':')[2], interaction.fields.getTextInputValue('subject'), interaction.fields.getTextInputValue('details'));
      if (interaction.customId === 'ticket:close-reason') return closeTicket(interaction, interaction.fields.getTextInputValue('reason'));
      if (interaction.customId === 'ticket:add-user') return handleUserModal(interaction, 'add');
      if (interaction.customId === 'ticket:remove-user') return handleUserModal(interaction, 'remove');
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'sync') { loadPrefixCommands(); return interaction.reply({ content: `Reloaded ${client.commands.size} prefix commands.`, ephemeral: true }); }
    if (interaction.commandName === 'deploy') { await interaction.deferReply({ ephemeral: true }); await deploySlashCommands(); return interaction.editReply('Slash commands deployed.'); }
    const command = client.slashCommands.get(interaction.commandName); if (command) await command.execute(interaction, client);
  } catch (error) { console.error('Interaction error:', error); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true }).catch(() => {}); }
});

const MEMBER_COUNT_CHANNEL_ID = process.env.MEMBER_COUNT_CHANNEL_ID || '';
async function updateMemberCount(guild) { if (!MEMBER_COUNT_CHANNEL_ID) return; const channel = await guild.channels.fetch(MEMBER_COUNT_CHANNEL_ID).catch(() => null); if (channel) await channel.setName(`👥 Members: ${guild.memberCount}`).catch(console.error); }
client.on(Events.GuildMemberAdd, (member) => updateMemberCount(member.guild));
client.on(Events.GuildMemberRemove, (member) => updateMemberCount(member.guild));
client.login(DISCORD_TOKEN);
