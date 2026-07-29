const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ContainerBuilder,
  MessageFlags,
} = require("discord.js");
const giveaways = require("../utils/giveawayManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName("start")
        .setDescription("Start a new giveaway (opens a form).")
    )
    .addSubcommand(sub =>
      sub.setName("edit")
        .setDescription("Edit an active giveaway (opens a form).")
        .addStringOption(opt => opt.setName("id").setDescription("Giveaway message ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("end")
        .setDescription("End a giveaway early and pick winners.")
        .addStringOption(opt => opt.setName("id").setDescription("Giveaway message ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("reroll")
        .setDescription("Reroll winners for an ended giveaway.")
        .addStringOption(opt => opt.setName("id").setDescription("Giveaway message ID").setRequired(true))
        .addIntegerOption(opt => opt.setName("winners").setDescription("Override how many winners to pick").setMinValue(1))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("List active giveaways in this server.")
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    if (sub === "start") return handleStart(interaction, client);
    if (sub === "edit") return handleEdit(interaction, client);
    if (sub === "end") return handleEnd(interaction, client);
    if (sub === "reroll") return handleReroll(interaction, client);
    if (sub === "list") return handleList(interaction, client);
  },
};

async function handleStart(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId("gw_start_modal")
    .setTitle("Start a Giveaway");

  const prize = new TextInputBuilder()
    .setCustomId("prize")
    .setLabel("What are you giving away?")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const winners = new TextInputBuilder()
    .setCustomId("winners")
    .setLabel("Number of winners")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 1")
    .setRequired(true)
    .setMaxLength(3);

  const duration = new TextInputBuilder()
    .setCustomId("duration")
    .setLabel("Duration")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 1d, 12h, 30m")
    .setRequired(true)
    .setMaxLength(50);

  const channel = new TextInputBuilder()
    .setCustomId("channel")
    .setLabel("Channel (ID or #mention)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Leave blank to post in this channel")
    .setRequired(false)
    .setMaxLength(50);

  const ping = new TextInputBuilder()
    .setCustomId("ping")
    .setLabel("Ping (none / here / everyone)")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Leave blank for no ping")
    .setRequired(false)
    .setMaxLength(20);

  modal.addComponents(
    new ActionRowBuilder().addComponents(prize),
    new ActionRowBuilder().addComponents(winners),
    new ActionRowBuilder().addComponents(duration),
    new ActionRowBuilder().addComponents(channel),
    new ActionRowBuilder().addComponents(ping),
  );

  return interaction.showModal(modal);
}

async function handleEdit(interaction, client) {
  const id = interaction.options.getString("id");
  const giveaway = giveaways.getGiveaway(id);

  if (!giveaway) return interaction.reply({ content: "No giveaway found with that message ID.", ephemeral: true });
  if (giveaway.guildId !== interaction.guildId) return interaction.reply({ content: "That giveaway isn't in this server.", ephemeral: true });
  if (giveaway.ended) return interaction.reply({ content: "You can't edit a giveaway that has already ended.", ephemeral: true });

  const modal = new ModalBuilder()
    .setCustomId(`gw_edit_modal:${id}`)
    .setTitle("Edit Giveaway");

  const prize = new TextInputBuilder()
    .setCustomId("prize")
    .setLabel("Prize")
    .setStyle(TextInputStyle.Short)
    .setValue(giveaway.prize || "")
    .setRequired(false)
    .setMaxLength(200);

  const winners = new TextInputBuilder()
    .setCustomId("winners")
    .setLabel("Number of winners")
    .setStyle(TextInputStyle.Short)
    .setValue(String(giveaway.winnersCount || ""))
    .setRequired(false)
    .setMaxLength(3);

  const duration = new TextInputBuilder()
    .setCustomId("duration")
    .setLabel("New remaining duration")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("e.g. 1h30m — leave blank to keep current end time")
    .setRequired(false)
    .setMaxLength(50);

  const requirements = new TextInputBuilder()
    .setCustomId("requirements")
    .setLabel("Requirements (type none to clear)")
    .setStyle(TextInputStyle.Paragraph)
    .setValue(giveaway.requirements || "")
    .setRequired(false)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(prize),
    new ActionRowBuilder().addComponents(winners),
    new ActionRowBuilder().addComponents(duration),
    new ActionRowBuilder().addComponents(requirements),
  );

  return interaction.showModal(modal);
}

async function handleEnd(interaction, client) {
  const id = interaction.options.getString("id");
  try {
    await interaction.deferReply({ ephemeral: true });
    const winners = await giveaways.endGiveaway(client, id);
    return interaction.editReply(
      winners.length
        ? `🎉 Giveaway ended. Winner(s): ${winners.map(w => `<@${w}>`).join(", ")}`
        : `Giveaway ended with no valid entries.`
    );
  } catch (err) {
    return interaction.editReply(`Couldn't end that giveaway: ${err.message}`);
  }
}

async function handleReroll(interaction, client) {
  const id = interaction.options.getString("id");
  const overrideCount = interaction.options.getInteger("winners") || undefined;
  try {
    await interaction.deferReply({ ephemeral: true });
    const winners = await giveaways.rerollGiveaway(client, id, overrideCount);
    return interaction.editReply(
      winners.length
        ? `🔁 Rerolled. New winner(s): ${winners.map(w => `<@${w}>`).join(", ")}`
        : `Rerolled, but there were no valid entries to pick from.`
    );
  } catch (err) {
    return interaction.editReply(`Couldn't reroll that giveaway: ${err.message}`);
  }
}

async function handleList(interaction, client) {
  const list = giveaways.getActiveByGuild(interaction.guildId);
  if (!list.length) return interaction.reply({ content: "There are no active giveaways in this server.", ephemeral: true });

  // Components V2 container — no accent color set, matches the giveaway
  // posts themselves instead of using the old colored EmbedBuilder.
  const container = new ContainerBuilder()
    .addTextDisplayComponents((t) => t.setContent("🎉 **Active Giveaways**"))
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((t) =>
      t.setContent(
        list
          .map(g => `**${g.prize}** — \`${g.id}\` — ends <t:${Math.floor(g.endTime / 1000)}:R> — ${g.entries.length} entries`)
          .join("\n")
      )
    );

  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
}