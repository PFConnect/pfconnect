const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ICON, BANNER } = require("../config");
const globalStatsCache = require("../utils/globalStatsCache");

const PILOTS_PER_PAGE = 10;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

function generatePilotDisplay(pilotsData, page, userId) {
    const start = (page - 1) * PILOTS_PER_PAGE;
    const end = Math.min(start + PILOTS_PER_PAGE, pilotsData.length);
    const totalPages = Math.ceil(pilotsData.length / PILOTS_PER_PAGE);

    const pilotsDisplay = pilotsData
        .slice(start, end)
        .map((pilot, index) => {
            const rank = start + index + 1;
            const flightsText = pilot.totalFlights === 1 ? "flight" : "flights";
            return `**#${rank}** <@${pilot.userId}> • ${pilot.totalFlights} ${flightsText}`;
        })
        .join("\n");

    const embed = new EmbedBuilder()
        .setAuthor({ name: "PFConnect Top Pilots", iconURL: ICON })
        .setColor("#000000")
        .setTitle("Top Pilots Across All Servers")
        .setDescription(pilotsDisplay)
        .setFooter({ text: `Page ${page}/${totalPages}` })
        .setImage(BANNER);

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pilots_first_${userId}`)
            .setLabel("First")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`pilots_prev_${userId}`)
            .setLabel("Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page <= 1),
        new ButtonBuilder()
            .setCustomId(`pilots_next_${userId}`)
            .setLabel("Next")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page >= totalPages),
        new ButtonBuilder()
            .setCustomId(`pilots_last_${userId}`)
            .setLabel("Last")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages)
    );

    return { embed, buttons };
}

module.exports = {
    data: {
        name: "pilots",
        description: "Displays the top pilots and their total flights across all servers",
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            await globalStatsCache.updateCache();
            const topPilots = globalStatsCache.getTopPilots(1000); // Get all pilots (capped at 1000)

            const { embed, buttons } = generatePilotDisplay(topPilots, 1, interaction.user.id);
            await interaction.editReply({
                embeds: [embed],
                components: [buttons],
            });
        } catch (error) {
            console.error("Error in /pilots command:", error);
            await interaction.editReply({
                content: "An error occurred while fetching pilot data.",
                ephemeral: true,
            });
        }
    },

    async handleButton(interaction) {
        const [_, action, userId] = interaction.customId.split("_");

        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: "These buttons are not for you.",
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();

        const embed = interaction.message.embeds[0];
        const footer = embed.footer.text;
        const currentPage = parseInt(footer.split("/")[0].replace("Page ", ""));
        const totalPages = parseInt(footer.split("/")[1]);

        let newPage = currentPage;
        switch (action) {
            case "first":
                newPage = 1;
                break;
            case "prev":
                newPage = Math.max(1, currentPage - 1);
                break;
            case "next":
                newPage = Math.min(totalPages, currentPage + 1);
                break;
            case "last":
                newPage = totalPages;
                break;
        }

        if (newPage === currentPage) return;

        await globalStatsCache.updateCache();
        const topPilots = globalStatsCache.getTopPilots(1000);

        const { embed: newEmbed, buttons } = generatePilotDisplay(topPilots, newPage, interaction.user.id);
        await interaction.editReply({
            embeds: [newEmbed],
            components: [buttons],
        });
    },
};
