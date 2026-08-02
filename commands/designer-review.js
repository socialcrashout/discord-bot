const fs = require("fs");
const path = require("path");

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
} = require("discord.js");

// ── Configure ─────────────────────────────────────────────

const STAFF_FEEDBACK_CHANNEL_ID = "1502529739997446245";

const BANNER_IMAGE_URL =
    "https://yumi.onl/api/files/6a697f51721650f7b5eb85c9/raw";

const FOOTER_IMAGE_URL =
    "https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw";

const DATA_DIR = path.join(__dirname, "..", "data");
const REVIEWS_PATH = path.join(DATA_DIR, "reviews.json");

const STAR_EMOJI = "<:Star:1531882389062684792>";

// ──────────────────────────────────────────────────────────

// Make sure the data directory + file exist before we ever try to read/write.
function ensureReviewsFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REVIEWS_PATH)) {
        fs.writeFileSync(REVIEWS_PATH, JSON.stringify([], null, 2));
    }
}

// ──────────────────────────────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName("designer-review")
        .setDescription("Leave a review for a designer")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The designer you're reviewing")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("stars")
                .setDescription("Rating")
                .setRequired(true)
                .addChoices(
                    { name: "1 — Needs Improvement", value: "1" },
                    { name: "2 — Below Expectations", value: "2" },
                    { name: "3 — Meets Expectations", value: "3" },
                    { name: "4 — Exceeds Expectations", value: "4" },
                    { name: "5 — Outstanding", value: "5" }
                )
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Your feedback")
                .setRequired(true)
        ),

    async execute(interaction) {
        const staff = interaction.options.getUser("user");
        const ratingValue = Number(
            interaction.options.getString("stars")
        );
        const feedback = interaction.options.getString("reason");

        const feedbackChannel =
            interaction.guild.channels.cache.get(
                STAFF_FEEDBACK_CHANNEL_ID
            );

        if (!feedbackChannel) {
            return interaction.reply({
                content: "Feedback channel not found.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const perms = feedbackChannel.permissionsFor(
            interaction.client.user
        );

        if (
            !perms?.has(PermissionFlagsBits.ViewChannel) ||
            !perms?.has(PermissionFlagsBits.SendMessages)
        ) {
            return interaction.reply({
                content:
                    "I don't have permission to send messages there.",
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            // Make sure /data and reviews.json exist before touching them
            ensureReviewsFile();

            // Load reviews
            const reviews = JSON.parse(
                fs.readFileSync(REVIEWS_PATH, "utf8")
            );

            // Save review
            reviews.push({
                userId: staff.id,
                reviewerId: interaction.user.id,
                stars: ratingValue,
                reason: feedback,
                createdAt: Date.now(),
            });

            fs.writeFileSync(
                REVIEWS_PATH,
                JSON.stringify(reviews, null, 2)
            );
        } catch (err) {
            console.error("Failed to save review:", err);
            return interaction.reply({
                content:
                    "❌ Something went wrong saving your review. Please try again.",
                flags: MessageFlags.Ephemeral,
            });
        }

        const stars = STAR_EMOJI.repeat(ratingValue);

        const container = new ContainerBuilder()
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(
                        BANNER_IMAGE_URL
                    )
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(
                    SeparatorSpacingSize.Small
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    "## New Review"
                )
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Review for:** ${staff}
**Rating:** ${stars}
**Submitted by:** ${interaction.user}
**Reason:** ${feedback}`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(
                    SeparatorSpacingSize.Small
                )
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(
                        FOOTER_IMAGE_URL
                    )
                )
            );

        await feedbackChannel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: {
                users: [staff.id],
            },
        });

        await interaction.reply({
            content:
                "✅ Your review has been submitted successfully.",
            flags: MessageFlags.Ephemeral,
        });
    },
};