const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
} = require("discord.js");

const config = require("../config/donationConfig");
const roblox = require("./robloxService");

// customId prefixes/ids — index.js routes interactions here by matching
// against these.
const SELECT_METHOD = "donate_method_select";
const SELECT_ROBUX_TYPE = "donate_robux_type_select";
const SELECT_ROBUX_PRICE_PREFIX = "donate_robux_price_select"; // + ":type"
const SELECT_USD_METHOD = "donate_usd_method_select";
const BTN_ROBUX_PAID_PREFIX = "donate_robux_paid"; // + ":type:price"
const BTN_USD_PAID_PREFIX = "donate_usd_paid"; // + ":method"
const MODAL_USD_AMOUNT_PREFIX = "donate_usd_amount_modal"; // + ":method"

const ROBUX_TYPE_LABELS = {
    tshirt: "T-Shirt (accounts under 16)",
    gamepass: "Gamepass (accounts 16+)",
};

const USD_METHOD_LABELS = {
    kofi: "Ko-fi",
    cashapp: "Cashapp",
};

function container(...parts) {
    const c = new ContainerBuilder();
    for (const part of parts) {
        if (part.type === "text") {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(part.content));
        } else if (part.type === "separator") {
            c.addSeparatorComponents(new SeparatorBuilder());
        } else if (part.type === "row") {
            c.addActionRowComponents(part.row);
        }
    }
    return c;
}

function payload(comp, ephemeral = true) {
    return {
        components: [comp],
        flags: ephemeral
            ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            : MessageFlags.IsComponentsV2,
    };
}

// ---------- STEP: method chosen (usd / robux) ----------

async function showRobuxTypeSelect(interaction) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(SELECT_ROBUX_TYPE)
            .setPlaceholder("Choose an option")
            .addOptions(
                { label: ROBUX_TYPE_LABELS.tshirt, value: "tshirt", emoji: "👕" },
                { label: ROBUX_TYPE_LABELS.gamepass, value: "gamepass", emoji: "🎫" }
            )
    );

    await interaction.update(
        payload(
            container(
                {
                    type: "text",
                    content:
                        "# 🎮 Robux Donation\nIf your Roblox account is under 16, use the T-Shirt option (game passes are hidden for you). Otherwise use the Gamepass option.",
                },
                { type: "separator" },
                { type: "row", row }
            )
        )
    );
}

async function showUsdMethodSelect(interaction) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(SELECT_USD_METHOD)
            .setPlaceholder("Choose a payment method")
            .addOptions(
                { label: USD_METHOD_LABELS.kofi, value: "kofi", emoji: "☕" },
                { label: USD_METHOD_LABELS.cashapp, value: "cashapp", emoji: "💵" }
            )
    );

    await interaction.update(
        payload(
            container(
                { type: "text", content: "# 💵 USD Donation\nChoose how you'd like to pay." },
                { type: "separator" },
                { type: "row", row }
            )
        )
    );
}

// ---------- STEP: robux type chosen -> show price select ----------

async function showRobuxPriceSelect(interaction, type) {
    const options = config.roblox.priceOptions.map((amount) => ({
        label: `${amount} Robux`,
        value: String(amount),
    }));

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`${SELECT_ROBUX_PRICE_PREFIX}:${type}`)
            .setPlaceholder("Choose an amount")
            .addOptions(options)
    );

    await interaction.update(
        payload(
            container(
                {
                    type: "text",
                    content: `# 🎮 Robux Donation\n**Option:** ${ROBUX_TYPE_LABELS[type]}\n\nChoose how much you'd like to donate.`,
                },
                { type: "separator" },
                { type: "row", row }
            )
        )
    );
}

// ---------- STEP: robux price chosen -> update price, show buy link ----------

async function handleRobuxPriceChosen(interaction, type, price) {
    await interaction.deferUpdate();

    try {
        if (type === "gamepass") {
            await roblox.updateGamepassPrice(price);
        } else {
            await roblox.updateTshirtPrice(price);
        }
    } catch (err) {
        console.error("Failed to update Roblox price:", err);
        await interaction.editReply(
            payload(
                container({
                    type: "text",
                    content:
                        "# ⚠️ Something went wrong\nWe couldn't update the price on Roblox's end. Please try again in a moment, or contact an admin.",
                })
            )
        );
        return;
    }

    const assetId = type === "gamepass" ? config.roblox.gamepassId : config.roblox.tshirtId;
    const buyUrl =
        type === "gamepass"
            ? `https://www.roblox.com/game-pass/${assetId}/`
            : `https://www.roblox.com/catalog/${assetId}/`;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel("Buy on Roblox").setStyle(ButtonStyle.Link).setURL(buyUrl),
        new ButtonBuilder()
            .setCustomId(`${BTN_ROBUX_PAID_PREFIX}:${type}:${price}`)
            .setLabel("I've Paid")
            .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply(
        payload(
            container(
                {
                    type: "text",
                    content: `# 🎮 Robux Donation\nThe price has been set to **${price} Robux**. Click below to purchase, then click **I've Paid** once you're done.`,
                },
                { type: "separator" },
                { type: "row", row }
            )
        )
    );
}

// ---------- STEP: robux "I've Paid" clicked ----------

async function handleRobuxPaid(interaction, type, price, client) {
    await interaction.update(
        payload(
            container({
                type: "text",
                content: "# ✅ Thank you!\nYour donation has been recorded. We appreciate you! 💖",
            })
        )
    );

    await postAppreciation(
        interaction,
        client,
        config.messages.robuxAppreciation(interaction.user.toString(), price)
    );
}

// ---------- STEP: usd method chosen -> show link + paid button ----------

async function handleUsdMethodChosen(interaction, method) {
    const url = method === "kofi" ? config.usd.kofiUrl : config.usd.cashappUrl;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel(`Donate on ${USD_METHOD_LABELS[method]}`).setStyle(ButtonStyle.Link).setURL(url),
        new ButtonBuilder()
            .setCustomId(`${BTN_USD_PAID_PREFIX}:${method}`)
            .setLabel("I've Paid")
            .setStyle(ButtonStyle.Success)
    );

    await interaction.update(
        payload(
            container(
                {
                    type: "text",
                    content: `# 💵 USD Donation\nClick below to donate via **${USD_METHOD_LABELS[method]}**. Once you're done, click **I've Paid** to let us know.`,
                },
                { type: "separator" },
                { type: "row", row }
            )
        )
    );
}

// ---------- STEP: usd "I've Paid" clicked -> ask for amount via modal ----------

async function handleUsdPaidClicked(interaction, method) {
    const modal = new ModalBuilder()
        .setCustomId(`${MODAL_USD_AMOUNT_PREFIX}:${method}`)
        .setTitle("Confirm your donation");

    const amountInput = new TextInputBuilder()
        .setCustomId("amount")
        .setLabel("How much did you donate (USD)?")
        .setPlaceholder("e.g. 5")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

    await interaction.showModal(modal);
}

// ---------- STEP: usd amount modal submitted ----------

async function handleUsdAmountSubmit(interaction, method, client) {
    const raw = interaction.fields.getTextInputValue("amount").trim();
    const amount = Number(raw.replace(/[^0-9.]/g, ""));

    if (!amount || amount <= 0) {
        await interaction.reply({
            content: "That doesn't look like a valid amount — please try clicking **I've Paid** again.",
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    await interaction.reply({
        content: "✅ Thank you! Your donation has been recorded. We appreciate you! 💖",
        flags: MessageFlags.Ephemeral,
    });

    await postAppreciation(
        interaction,
        client,
        config.messages.usdAppreciation(interaction.user.toString(), amount)
    );
}

// ---------- shared helper ----------

async function postAppreciation(interaction, client, message) {
    try {
        const channel = await client.channels.fetch(config.appreciationChannelId);
        if (!channel) return;

        const box = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(message)
        );

        await channel.send({
            components: [box],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (err) {
        console.error("Failed to send donation appreciation message:", err);
    }
}

// ---------- entry points called from index.js ----------

async function handleSelectMenu(interaction, client) {
    const { customId, values } = interaction;
    const value = values[0];

    if (customId === SELECT_METHOD) {
        if (value === "robux") return showRobuxTypeSelect(interaction);
        if (value === "usd") return showUsdMethodSelect(interaction);
        return;
    }

    if (customId === SELECT_ROBUX_TYPE) {
        return showRobuxPriceSelect(interaction, value);
    }

    if (customId.startsWith(SELECT_ROBUX_PRICE_PREFIX)) {
        const [, type] = customId.split(":");
        return handleRobuxPriceChosen(interaction, type, Number(value));
    }

    if (customId === SELECT_USD_METHOD) {
        return handleUsdMethodChosen(interaction, value);
    }
}

async function handleButton(interaction, client) {
    const { customId } = interaction;

    if (customId.startsWith(BTN_ROBUX_PAID_PREFIX)) {
        const [, type, price] = customId.split(":");
        return handleRobuxPaid(interaction, type, Number(price), client);
    }

    if (customId.startsWith(BTN_USD_PAID_PREFIX)) {
        const [, method] = customId.split(":");
        return handleUsdPaidClicked(interaction, method);
    }
}

async function handleModalSubmit(interaction, client) {
    const { customId } = interaction;

    if (customId.startsWith(MODAL_USD_AMOUNT_PREFIX)) {
        const [, method] = customId.split(":");
        return handleUsdAmountSubmit(interaction, method, client);
    }
}

module.exports = {
    SELECT_METHOD,
    SELECT_ROBUX_TYPE,
    SELECT_ROBUX_PRICE_PREFIX,
    SELECT_USD_METHOD,
    BTN_ROBUX_PAID_PREFIX,
    BTN_USD_PAID_PREFIX,
    MODAL_USD_AMOUNT_PREFIX,
    handleSelectMenu,
    handleButton,
    handleModalSubmit,
};