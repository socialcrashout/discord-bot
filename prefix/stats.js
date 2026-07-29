const fs = require("fs");
const path = require("path");

const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
} = require("discord.js");

// ── Configure ─────────────────────────────────────────────

const REVIEWS_PATH = path.join(__dirname, "..", "data", "reviews.json");

const STAR_EMOJI = "⭐"; // Change your emoji here

const FOOTER_IMAGE_URL =
    "https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw";

const BANNER_IMAGE_URL =
    ""; // Add banner URL here if needed

// ──────────────────────────────────────────────────────────


module.exports = {
    name: "stats",

    async execute(message) {

        let reviews = [];

        if (fs.existsSync(REVIEWS_PATH)) {
            reviews = JSON.parse(
                fs.readFileSync(REVIEWS_PATH, "utf8")
            );
        }

        const ratings = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
        };

        let totalStars = 0;

        for (const review of reviews) {
            ratings[review.stars]++;
            totalStars += review.stars;
        }

        const totalReviews = reviews.length;

        const average = totalReviews
            ? (totalStars / totalReviews).toFixed(1)
            : "0.0";


        const container = new ContainerBuilder();


        if (BANNER_IMAGE_URL) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(BANNER_IMAGE_URL)
                    )
            );
        }


        container
            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent("## Review Statistics")
            )

            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
`${STAR_EMOJI.repeat(5)} - ${ratings[5]} reviews
${STAR_EMOJI.repeat(4)} - ${ratings[4]} reviews
${STAR_EMOJI.repeat(3)} - ${ratings[3]} reviews
${STAR_EMOJI.repeat(2)} - ${ratings[2]} reviews
${STAR_EMOJI} - ${ratings[1]} reviews

**Total Reviews:** ${totalReviews}
**Average Rating:** ${average} / 5`
                    )
            )

            .addSeparatorComponents(
                new SeparatorBuilder()
                    .setSpacing(SeparatorSpacingSize.Small)
            )

            .addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(FOOTER_IMAGE_URL)
                    )
            );


        await message.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};