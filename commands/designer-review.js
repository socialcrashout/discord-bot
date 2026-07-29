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
} = require('discord.js');

// ── Configure these ────────────────────────────────────────────────────────
const STAFF_FEEDBACK_CHANNEL_ID = '1502529739997446245';
const BANNER_IMAGE_URL = 'https://yumi.onl/api/files/6a697f51721650f7b5eb85c9/raw';
const FOOTER_IMAGE_URL = 'https://yumi.onl/api/files/6a6974fa91bbc4fb21f03ab5/raw';
// ─────────────────────────────────────────────────────────────────────────

const STAR_EMOJI = '<:Star:1531882389062684792>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('designer-review')
        .setDescription('Leave a review for a designer')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The designer you are reviewing')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('stars')
                .setDescription('Your rating (1-5)')
                .setRequired(true)
                .addChoices(
                    { name: '1 — Needs Improvement', value: '1' },
                    { name: '2 — Below Expectations', value: '2' },
                    { name: '3 — Meets Expectations', value: '3' },
                    { name: '4 — Exceeds Expectations', value: '4' },
                    { name: '5 — Outstanding', value: '5' },
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Your feedback')
                .setRequired(true)),

    async execute(interaction) {
        const staff = interaction.options.getUser('user');
        const ratingValue = Number(interaction.options.getString('stars'));
        const stars = STAR_EMOJI.repeat(ratingValue);
        const feedback = interaction.options.getString('reason');

        const feedbackChannel = interaction.guild.channels.cache.get(STAFF_FEEDBACK_CHANNEL_ID);

        if (!feedbackChannel) {
            return interaction.reply({
                content: 'Staff feedback channel not found. Please contact an admin.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const botPermissions = feedbackChannel.permissionsFor(interaction.client.user);
        if (!botPermissions?.has(PermissionFlagsBits.SendMessages) ||
            !botPermissions?.has(PermissionFlagsBits.ViewChannel)) {
            return interaction.reply({
                content: 'I do not have permission to send messages in the staff feedback channel.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const container = new ContainerBuilder()
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(BANNER_IMAGE_URL),
                ),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## New Review'),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    [
                        `**Review for:** ${staff}`,
                        `**Rating:** ${stars}`,
                        `**Submitted by:** ${interaction.user}`,
                        `**Reason:** ${feedback}`,
                    ].join('\n'),
                ),
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small),
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(FOOTER_IMAGE_URL),
                ),
            );

        await feedbackChannel.send({
            allowedMentions: { users: [staff.id] },
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });

        await interaction.reply({
            content: 'Your feedback has been submitted and sent to the staff feedback channel.',
            flags: MessageFlags.Ephemeral,
        });
    },
};