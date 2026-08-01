const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const stickyManager = require('../utils/stickyManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stick')
        .setDescription('Manage the sticky message for this channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Set (or update) the sticky message for this channel.')
                .addStringOption(opt =>
                    opt
                        .setName('message')
                        .setDescription('The text to stick to the bottom of this channel.')
                        .setRequired(true)
                        .setMaxLength(3900)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Remove the sticky message from this channel.')
        ),

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const channel = interaction.channel;

        if (sub === 'set') {
            const content = interaction.options.getString('message', true);

            await interaction.deferReply({ ephemeral: true });

            // Clean up any existing sticky in this channel first.
            const existing = stickyManager.getSticky(channel.id);
            if (existing && existing.messageId) {
                try {
                    const oldMessage = await channel.messages.fetch(existing.messageId);
                    if (oldMessage) await oldMessage.delete().catch(() => null);
                } catch (err) {
                    // Already gone, ignore.
                }
            }

            stickyManager.setSticky(channel.id, content, null);

            try {
                const message = await stickyManager.postSticky(channel, content);
                stickyManager.updateStickyMessageId(channel.id, message.id);
            } catch (err) {
                console.error('[stick] failed to send sticky message:', err);
                return interaction.editReply(
                    'Failed to send the sticky message. Check my permissions in this channel.'
                );
            }

            return interaction.editReply(`Sticky message set in ${channel}.`);
        }

        if (sub === 'remove') {
            await interaction.deferReply({ ephemeral: true });

            const existing = stickyManager.getSticky(channel.id);
            if (!existing) {
                return interaction.editReply('There is no sticky message in this channel.');
            }

            if (existing.messageId) {
                try {
                    const oldMessage = await channel.messages.fetch(existing.messageId);
                    if (oldMessage) await oldMessage.delete().catch(() => null);
                } catch (err) {
                    // Already gone, ignore.
                }
            }

            stickyManager.removeSticky(channel.id);
            return interaction.editReply('Sticky message removed from this channel.');
        }
    },
};