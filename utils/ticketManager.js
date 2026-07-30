const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    MessageFlags,
    AttachmentBuilder,
    ChannelType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const config = require("../config");
const { parseEmoji } = require("./emoji");
const { generateTranscript } = require("./transcript");

const SELECT_ID = "ticket_panel_select";
const BTN_CLAIM = "ticket_claim";
const BTN_CLOSE = "ticket_close";
const BTN_CLOSE_CONFIRM = "ticket_close_confirm";
const BTN_CLOSE_CANCEL = "ticket_close_cancel";
const BTN_ESCALATE = "ticket_escalate";

/* ------------------------------------------------------------------ *
 *  Small persistent counter so ticket channel names don't collide
 *  even after a restart. Stored in data/ticketCount.json
 * ------------------------------------------------------------------ */
const COUNTER_FILE = path.join(__dirname, "..", "data", "ticketCount.json");

function nextTicketNumber() {
    let n = 1;
    try {
        const raw = JSON.parse(fs.readFileSync(COUNTER_FILE, "utf-8"));
        n = (raw.count || 0) + 1;
    } catch {
        /* file doesn't exist yet - start at 1 */
    }
    fs.mkdirSync(path.dirname(COUNTER_FILE), { recursive: true });
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count: n }, null, 2));
    return n;
}

/* ------------------------------------------------------------------ *
 *  Fill {placeholders} in config text templates
 * ------------------------------------------------------------------ */
function fill(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ""));
}

/* ------------------------------------------------------------------ *
 *  PANEL CONTAINER  (-panel command)
 * ------------------------------------------------------------------ */
function buildPanelContainer() {
    const container = new ContainerBuilder(); // no .setAccentColor() = no accent color

    if (config.panel.bannerUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(config.panel.bannerUrl)
            )
        );
    }

    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(config.panel.text));

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECT_ID)
        .setPlaceholder(config.panel.selectPlaceholder)
        .addOptions(
            config.categories.map((cat) => {
                const opt = new StringSelectMenuOptionBuilder()
                    .setLabel(cat.label)
                    .setDescription(cat.description)
                    .setValue(cat.id);
                const emoji = parseEmoji(cat.emoji);
                if (emoji) opt.setEmoji(emoji);
                return opt;
            })
        );

    container.addActionRowComponents(new ActionRowBuilder().addComponents(select));

    if (config.panel.footerUrl) {
        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(config.panel.footerUrl)
            )
        );
    }

    return container;
}

/* ------------------------------------------------------------------ *
 *  TICKET WELCOME CONTAINER (sent inside the new ticket channel)
 * ------------------------------------------------------------------ */
function buildTicketContainer(member, category, { claimed = null, escalated = false } = {}) {
    const container = new ContainerBuilder();

    if (config.ticket.bannerUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.ticket.bannerUrl))
        );
    }

    const text = fill(config.ticket.text, { user: `${member}`, category: category.label });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    if (claimed) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# Claimed by ${claimed}`)
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BTN_CLAIM)
            .setLabel(claimed ? "Claimed" : "Claim")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(Boolean(claimed)),
        new ButtonBuilder().setCustomId(BTN_CLOSE).setLabel("Close").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(BTN_ESCALATE)
            .setLabel("Escalate")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(escalated)
    );

    container.addActionRowComponents(row);

    return container;
}

function buildCloseConfirmContainer() {
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Are you sure you want to close this ticket? A transcript will be saved.")
    );
    container.addActionRowComponents(
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(BTN_CLOSE_CONFIRM).setLabel("Confirm Close").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(BTN_CLOSE_CANCEL).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
        )
    );
    return container;
}

function buildEscalateContainer(member, staff) {
    const container = new ContainerBuilder();
    const roleId = config.ids.managementRoleId;
    const text = fill(config.escalate.text, { user: `${member}`, staff: `${staff}` });
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    return { container, pingText: fill(config.escalate.pingText, { user: `${member}`, role: roleId ? `<@&${roleId}>` : "" }) };
}

/* ------------------------------------------------------------------ *
 *  SELECT MENU HANDLER -> creates the ticket channel
 * ------------------------------------------------------------------ */
async function handleCategorySelect(interaction) {
    const categoryId = interaction.values[0];
    const category = config.categories.find((c) => c.id === categoryId);
    if (!category) {
        return interaction.reply({ content: "Unknown category, tell an admin.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const pingRoleId = category.pingRoleId || config.ids.supportRoleId;
    const num = String(nextTicketNumber()).padStart(4, "0");
    const channelName = `${category.channelPrefix}-${num}`;

    const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
            id: interaction.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
            ],
        },
    ];

    if (pingRoleId) {
        overwrites.push({
            id: pingRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.ids.ticketsCategoryId || undefined,
        permissionOverwrites: overwrites,
        topic: `Ticket for ${interaction.user.tag} | category: ${category.label} | opener: ${interaction.user.id}`,
    });

    const container = buildTicketContainer(interaction.user, category);
    const pingText = fill(config.ticket.pingText, {
        user: `${interaction.user}`,
        role: pingRoleId ? `<@&${pingRoleId}>` : "",
    }).trim();

    await channel.send({
        content: pingText || undefined,
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { users: [interaction.user.id], roles: pingRoleId ? [pingRoleId] : [] },
    });

    await interaction.editReply({ content: `Ticket created: ${channel}` });
}

/* ------------------------------------------------------------------ *
 *  BUTTON HANDLER -> claim / close / escalate
 * ------------------------------------------------------------------ */
async function handleButton(interaction) {
    const { customId, channel, member } = interaction;
    const isStaff = config.ids.supportRoleId ? member.roles.cache.has(config.ids.supportRoleId) : true;

    switch (customId) {
        case BTN_CLAIM: {
            if (!isStaff) {
                return interaction.reply({ content: "Only support staff can claim tickets.", ephemeral: true });
            }
            const category = config.categories.find((c) => channel.name.startsWith(c.channelPrefix)) || config.categories[0];
            const openerId = channel.topic?.match(/opener: (\d+)/)?.[1];
            const opener = openerId ? await interaction.guild.members.fetch(openerId).catch(() => null) : null;

            const container = buildTicketContainer(opener?.user || "the ticket opener", category, { claimed: interaction.user });
            await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
            break;
        }

        case BTN_CLOSE: {
            const confirm = buildCloseConfirmContainer();
            await interaction.reply({ components: [confirm], flags: MessageFlags.IsComponentsV2, ephemeral: true });
            break;
        }

        case BTN_CLOSE_CANCEL: {
            await interaction.update({ content: "Cancelled.", components: [] });
            break;
        }

        case BTN_CLOSE_CONFIRM: {
            await interaction.update({ content: "Closing ticket & generating transcript...", components: [] });
            await closeTicket(channel, interaction.user);
            break;
        }

        case BTN_ESCALATE: {
            if (!isStaff) {
                return interaction.reply({ content: "Only support staff can escalate tickets.", ephemeral: true });
            }
            const openerId = channel.topic?.match(/opener: (\d+)/)?.[1];
            const opener = openerId ? await interaction.guild.members.fetch(openerId).catch(() => null) : null;

            const { container, pingText } = buildEscalateContainer(opener?.user || "the ticket opener", interaction.user);
            await channel.send({
                content: pingText || undefined,
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { roles: config.ids.managementRoleId ? [config.ids.managementRoleId] : [] },
            });
            await interaction.reply({ content: "Ticket escalated.", ephemeral: true });
            break;
        }

        default:
            break;
    }
}

/* ------------------------------------------------------------------ *
 *  CLOSE + TRANSCRIPT
 * ------------------------------------------------------------------ */
async function closeTicket(channel, closedBy) {
    let filePath, fileName;
    try {
        ({ filePath, fileName } = await generateTranscript(channel));
    } catch (err) {
        console.error("Failed to generate transcript:", err);
    }

    if (filePath && config.ids.transcriptLogChannelId) {
        try {
            const logChannel = await channel.guild.channels.fetch(config.ids.transcriptLogChannelId);
            if (logChannel) {
                await logChannel.send({
                    content: `Transcript for **#${channel.name}** — closed by ${closedBy}`,
                    files: [new AttachmentBuilder(filePath, { name: fileName })],
                });
            }
        } catch (err) {
            console.error("Failed to post transcript:", err);
        }
    }

    if (config.behavior.onClose === "archive" && config.behavior.archiveCategoryId) {
        await channel.setParent(config.behavior.archiveCategoryId, { lockPermissions: false }).catch(console.error);
        await channel.permissionOverwrites
            .edit(channel.guild.roles.everyone, { SendMessages: false })
            .catch(console.error);
        return;
    }

    setTimeout(() => {
        channel.delete().catch(console.error);
    }, (config.behavior.closeDelaySeconds || 5) * 1000);
}

module.exports = {
    SELECT_ID,
    BTN_CLAIM,
    BTN_CLOSE,
    BTN_CLOSE_CONFIRM,
    BTN_CLOSE_CANCEL,
    BTN_ESCALATE,
    buildPanelContainer,
    handleCategorySelect,
    handleButton,
};