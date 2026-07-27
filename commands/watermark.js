const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const sharp = require('sharp');

const WATERMARK_URL = 'https://yumi.onl/api/files/6a6576e60f65db043bedcd27/raw';

async function fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('watermark')
        .setDescription('Add watermark to an image.')
        .addAttachmentOption(option =>
            option.setName('image')
                  .setDescription('The image to watermark')
                  .setRequired(true)
        ),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('image');
        if (!attachment || !attachment.contentType || !attachment.contentType.startsWith('image/')) {
            return interaction.reply({ content: 'Please provide a valid image.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const [imageBuffer, watermarkBuffer] = await Promise.all([
                fetchBuffer(attachment.url),
                fetchBuffer(WATERMARK_URL)
            ]);

            const image = sharp(imageBuffer);
            const metadata = await image.metadata();

            // Resize watermark to cover the image, and bake in ~40% opacity
            // via the alpha channel (sharp's composite() has no "opacity" option).
            const watermarkResized = await sharp(watermarkBuffer)
                .resize(metadata.width, metadata.height, { fit: 'cover' })
                .ensureAlpha(0.4)
                .png()
                .toBuffer();

            const watermarkedBuffer = await sharp(imageBuffer)
                .ensureAlpha()
                .composite([
                    {
                        input: watermarkResized,
                        blend: 'over',
                    }
                ])
                .png()
                .toBuffer();

            const watermarkedAttachment = new AttachmentBuilder(watermarkedBuffer, { name: 'watermarked.png' });

            await interaction.editReply({ files: [watermarkedAttachment] });
        } catch (err) {
            console.error('Watermark error:', err);
            return interaction.editReply({ content: 'Failed to apply watermark.' });
        }
    }
};