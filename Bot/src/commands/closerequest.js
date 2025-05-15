const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { closeTicket } = require("../functions/ticketFunctions");

const IMAGE_ORANGE = "https://pflufthansavirtual.com/Pictures/pfc_orange_line.png";
const IMAGE_GREEN = "https://pflufthansavirtual.com/Pictures/pfc_green_line.png";
const IMAGE_RED = "https://pflufthansavirtual.com/Pictures/pfc_red_line.png";

module.exports = {
    data: {
        name: "closerequest",
        description: "Request to close a ticket (asks the ticket creator for confirmation).",
    },
    async execute(interaction) {
        try {
            const topic = interaction.channel.topic;
            const ticketCreatorId = topic?.match(/Ticket created by (\d+)/)?.[1];

            if (!ticketCreatorId) {
                return interaction.reply({
                    content: "This channel is not a valid ticket channel.",
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor("#ffcc00")
                .setTitle("Ticket Close Request")
                .setDescription(`<@${ticketCreatorId}>, do you agree to close this ticket?`)
                .setImage(IMAGE_ORANGE);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_close_${ticketCreatorId}`)
                    .setLabel("Yes, close it")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`deny_keep_open_${ticketCreatorId}`)
                    .setLabel("No, keep open")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({
                content: `<@${ticketCreatorId}>`,
                embeds: [embed],
                components: [row],
            });
        } catch (error) {
            console.error("Error in closerequest command:", error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "An error occurred while processing the close request.",
                    ephemeral: true,
                });
            }
        }
    },

    async handleButton(interaction) {
        const ticketCreatorId = interaction.customId.split("_").pop();
        if (interaction.user.id !== ticketCreatorId) {
            return interaction.reply({
                content: "Only the ticket creator can respond to this request.",
                ephemeral: true,
            });
        }

        if (interaction.customId.startsWith("accept_close_")) {
            const embed = new EmbedBuilder()
                .setColor("#00cc66")
                .setTitle("Ticket Closed")
                .setDescription("The ticket will now be closed. Thank you!")
                .setImage(IMAGE_GREEN);

            await interaction.update({
                content: "",
                embeds: [embed],
                components: [],
            });

            await closeTicket(interaction, true, false);
        } else if (interaction.customId.startsWith("deny_keep_open_")) {
            const embed = new EmbedBuilder()
                .setColor("#cc0000")
                .setTitle("Ticket Close Request Denied")
                .setDescription("The ticket will remain open.")
                .setImage(IMAGE_RED);

            await interaction.update({
                content: "",
                embeds: [embed],
                components: [],
            });
        }
    },
};
