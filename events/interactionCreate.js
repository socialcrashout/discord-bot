const {
  Events,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const giveaways = require("../utils/giveawayManager");

module.exports = {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction, client) {
    // Chat input (slash) commands are already handled in index.js — ignore those here.

    // ---- Step 1: main "Start a Giveaway" form ----
    if (interaction.isModalSubmit() && interaction.customId === "gw_start_modal") {
      const prize = interaction.fields.getTextInputValue("prize").trim();
      const winnersRaw = interaction.fields.getTextInputValue("winners").trim();
      const durationRaw = interaction.fields.getTextInputValue("duration").trim();
      const channelRaw = interaction.fields.getTextInputValue("channel").trim();
      const pingRaw = interaction.fields.getTextInputValue("ping").trim().toLowerCase();

      const winnersCount = parseInt(winnersRaw, 10);
      if (!winnersCount || winnersCount < 1) {
        return interaction.reply({ content: "Winners must be a whole number of 1 or more.", ephemeral: true });
      }

      const durationMs = giveaways.parseDuration(durationRaw);
      if (!durationMs || durationMs <= 0) {
        return interaction.reply({ content: "That duration didn't parse. Try something like `10m`, `2h`, `1d12h`.", ephemeral: true });
      }

      let channel = interaction.channel;
      if (channelRaw) {
        const idMatch = channelRaw.match(/\d{15,}/);
        const resolved = idMatch ? await interaction.guild.channels.fetch(idMatch[0]).catch(() => null) : null;
        if (!resolved) {
          return interaction.reply({ content: "Couldn't find that channel — check the ID/mention and try again.", ephemeral: true });
        }
        channel = resolved;
      }

      let pingType = "none";
      if (pingRaw === "here") pingType = "here";
      else if (pingRaw === "everyone") pingType = "everyone";
      else if (pingRaw && pingRaw !== "none") {
        return interaction.reply({ content: "Ping must be `none`, `here`, or `everyone`.", ephemeral: true });
      }

      const draftId = `${interaction.id}`;
      giveaways.createDraft(draftId, {
        prize,
        winnersCount,
        endTime: Date.now() + durationMs,
        channelId: channel.id,
        hostId: interaction.user.id,
        hostName: interaction.user.username,
        pingType,
        bannerUrl: null,
        requirements: null,
        entries: [],
        ended: false,
      });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`gw_req_select:${draftId}`)
          .setPlaceholder("Add entry requirements or a banner image?")
          .addOptions(
            { label: "Yes — add requirements/banner", value: "yes", emoji: "✅" },
            { label: "No — post as is", value: "no", emoji: "🚫" },
          )
      );

      return interaction.reply({
        content: `Setting up **${prize}** in ${channel} — want to add entry requirements or a banner image?`,
        components: [row],
        ephemeral: true,
      });
    }

    // ---- Step 2a: "requirements/banner?" select menu ----
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("gw_req_select:")) {
      const draftId = interaction.customId.split(":")[1];
      const draft = giveaways.getDraft(draftId);
      if (!draft) {
        return interaction.update({ content: "This setup expired — please run `/giveaway start` again.", components: [] });
      }

      const choice = interaction.values[0];

      if (choice === "no") {
        try {
          const msg = await giveaways.postGiveaway(client, draft);
          giveaways.deleteDraft(draftId);
          return interaction.update({ content: `✅ Giveaway posted in <#${msg.channelId}>!`, components: [] });
        } catch (err) {
          return interaction.update({ content: `Failed to post giveaway: ${err.message}`, components: [] });
        }
      }

      if (choice === "yes") {
        draft.selectInteraction = interaction;
        giveaways.createDraft(draftId, draft);

        const modal = new ModalBuilder()
          .setCustomId(`gw_req_modal:${draftId}`)
          .setTitle("Requirements & Banner");

        const requirements = new TextInputBuilder()
          .setCustomId("requirements_text")
          .setLabel("Entry requirements")
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder("e.g. Must be level 5+, follow our socials, etc.")
          .setRequired(false)
          .setMaxLength(1000);

        const banner = new TextInputBuilder()
          .setCustomId("banner_url")
          .setLabel("Banner image URL")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("Leave blank for no banner")
          .setRequired(false)
          .setMaxLength(500);

        modal.addComponents(
          new ActionRowBuilder().addComponents(requirements),
          new ActionRowBuilder().addComponents(banner),
        );

        return interaction.showModal(modal);
      }
    }

    // ---- Step 2b: requirements/banner form submission ----
    if (interaction.isModalSubmit() && interaction.customId.startsWith("gw_req_modal:")) {
      const draftId = interaction.customId.split(":")[1];
      const draft = giveaways.getDraft(draftId);
      if (!draft) {
        return interaction.reply({ content: "This setup expired — please run `/giveaway start` again.", ephemeral: true });
      }

      const requirements = interaction.fields.getTextInputValue("requirements_text").trim();
      const banner = interaction.fields.getTextInputValue("banner_url").trim();
      draft.requirements = requirements || null;
      draft.bannerUrl = banner || null;

      try {
        const msg = await giveaways.postGiveaway(client, draft);
        giveaways.deleteDraft(draftId);
        await interaction.reply({ content: `✅ Giveaway posted in <#${msg.channelId}>!`, ephemeral: true });

        if (draft.selectInteraction) {
          await draft.selectInteraction.editReply({
            content: `✅ Giveaway posted in <#${msg.channelId}>!`,
            components: [],
          }).catch(() => null);
        }
      } catch (err) {
        await interaction.reply({ content: `Failed to post giveaway: ${err.message}`, ephemeral: true });
      }
      return;
    }

    // ---- Edit form submission ----
    if (interaction.isModalSubmit() && interaction.customId.startsWith("gw_edit_modal:")) {
      const id = interaction.customId.split(":")[1];

      const prizeRaw = interaction.fields.getTextInputValue("prize").trim();
      const winnersRaw = interaction.fields.getTextInputValue("winners").trim();
      const durationRaw = interaction.fields.getTextInputValue("duration").trim();
      const requirementsRaw = interaction.fields.getTextInputValue("requirements").trim();
      const bannerRaw = interaction.fields.getTextInputValue("banner").trim();

      const updates = {};

      if (prizeRaw) updates.prize = prizeRaw;

      if (winnersRaw) {
        const winnersCount = parseInt(winnersRaw, 10);
        if (!winnersCount || winnersCount < 1) {
          return interaction.reply({ content: "Winners must be a whole number of 1 or more.", ephemeral: true });
        }
        updates.winnersCount = winnersCount;
      }

      if (durationRaw) {
        const ms = giveaways.parseDuration(durationRaw);
        if (!ms) return interaction.reply({ content: "That duration didn't parse.", ephemeral: true });
        updates.durationMs = ms;
      }

      if (requirementsRaw) updates.requirements = requirementsRaw.toLowerCase() === "none" ? null : requirementsRaw;
      if (bannerRaw) updates.bannerUrl = bannerRaw.toLowerCase() === "none" ? null : bannerRaw;

      if (Object.keys(updates).length === 0) {
        return interaction.reply({ content: "You didn't change anything.", ephemeral: true });
      }

      try {
        await giveaways.editGiveaway(client, id, updates);
        return interaction.reply({ content: `✅ Giveaway \`${id}\` updated.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `Couldn't edit that giveaway: ${err.message}`, ephemeral: true });
      }
    }

    // ---- Enter/leave giveaway button ----
    if (interaction.isButton() && interaction.customId === "gw_enter") {
      const giveaway = giveaways.getGiveaway(interaction.message.id);
      if (!giveaway) {
        return interaction.reply({ content: "This giveaway couldn't be found — it may be from before a restart.", ephemeral: true });
      }
      if (giveaway.ended) {
        return interaction.reply({ content: "This giveaway has already ended.", ephemeral: true });
      }

      const result = giveaways.toggleEntry(giveaway.id, interaction.user.id);
      await interaction.reply({
        content: result.entered ? "🎉 You're entered! Good luck!" : "You left the giveaway.",
        ephemeral: true,
      });

      try {
        await interaction.message.edit({
          embeds: [giveaways.buildEmbed(result.giveaway, false)],
          components: giveaways.buildComponents(result.giveaway, false),
        });
      } catch (err) {
        console.error("[giveaways] failed to update entry count:", err);
      }
      return;
    }
  },
};