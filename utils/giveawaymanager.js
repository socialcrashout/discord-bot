const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');

// Configuration: customize emojis and button labels
const CONFIG = {
  EMOJIS: {
    title: "<:confetti:1502514534298943509>",
    enter: "<:Star:1531882389062684792>",
    ended: "<:Lock:1502513716384632873>",
    entries: "<:Member:1502514198595240076>",
    duration: "<:Calendar:1502513561866473734>",
    winner: "<:cheers:1502514532331946006>",
  },
  BUTTONS: {
    enterLabel: "Join Giveaway",
    endedLabel: "Ended",
    entriesLabelSuffix: "Entries",
  },
};

// Example giveaway data
const giveaway = {
  id: "GID-8NWS2DI",
  prize: "Awesome Course",
  price: "$50",
  hostedBy: "@liquid",
  endTime: Date.now() + 3600 * 1000, // 1 hour from now
  requirements: "React with 🎉 and follow the page",
  entries: [], // User IDs
  winnersCount: 3,
  ended: false,
};

// Function to create the giveaway banner embed
function createGiveawayEmbed(giveaway, winners = []) {
  const { EMOJIS } = CONFIG;

  const embed = new MessageEmbed()
    .setColor('#0099ff')
    .setTitle(`${EMOJIS.title} **${giveaway.prize}**`)
    .addFields(
      { name: `**${EMOJIS.title} Price:**`, value: giveaway.price || 'N/A' },
      { name: `**${EMOJIS.winner} Winners:**`, value: winners.length ? winners.map(w => `<@${w}>`).join(', ') : 'No winners yet' },
      { name: `**:person: Hosted by:**`, value: giveaway.hostedBy || 'N/A' },
      { name: `**${EMOJIS.duration} Duration:**`, value: giveaway.ended ? 'Ended' : `<t:${Math.floor(giveaway.endTime / 1000)}>:R` },
      { name: `**:Save: Giveaway ID:**`, value: giveaway.id }
    )
    // Divider line for visual separation
    .addFields({ name: '──────────────', value: '──────────────' })
    // Footer
    .setFooter({ text: 'Footer' });

  return embed;
}

// Function to create the interactive buttons
function createGiveawayButtons(giveaway) {
  const { BUTTONS, EMOJIS } = CONFIG;

  const joinButton = new MessageButton()
    .setCustomId('gw_join')
    .setLabel(BUTTONS.enterLabel)
    .setStyle('PRIMARY')
    .setEmoji(EMOJIS.enter);

  const entriesButton = new MessageButton()
    .setCustomId('gw_entries_count')
    .setLabel(`${giveaway.entries.length} ${BUTTONS.entriesLabelSuffix}`)
    .setStyle('SECONDARY')
    .setDisabled(true)
    .setEmoji(EMOJIS.entries);

  return new MessageActionRow().addComponents(joinButton, entriesButton);
}

// Example function to send the giveaway message
async function sendGiveaway(channel) {
  const embed = createGiveawayEmbed(giveaway);
  const components = [createGiveawayButtons(giveaway)];
  const message = await channel.send({ embeds: [embed], components: components });
  return message;
}

// Interaction handler for button clicks
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // Handle "Join" button
  if (interaction.customId === 'gw_join') {
    if (!giveaway.entries.includes(interaction.user.id)) {
      giveaway.entries.push(interaction.user.id);
    }
    // Update the message with new entries count
    const embed = createGiveawayEmbed(giveaway);
    const components = [createGiveawayButtons(giveaway)];
    await interaction.update({ embeds: [embed], components: components });
  }
});