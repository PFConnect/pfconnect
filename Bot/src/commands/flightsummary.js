const { EmbedBuilder } = require("discord.js");
const { loadFlightData, loadGuildData } = require("../functions/api_utils");

module.exports = {
    data: {
        name: "flightsummary",
        description: "Summarize flights of a user.",
        options: [
            {
                name: "user",
                type: 6,
                description: "The user whose flights you want to check",
                required: true,
            },
        ],
    },
    async execute(interaction) {
        const user = interaction.options.getUser("user");
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);
        const bannerUrl = guildData?.bannerUrl || "https://pflufthansavirtual.com/Fotos/pfc_banner.png";

        try {
            // Defer the reply to prevent timeout
            await interaction.deferReply();

            const flightData = await loadFlightData(guildId);
            const userFlights = flightData[guildId]?.users[user.id]?.flights || [];
            const totalPoints = flightData[guildId]?.users[user.id]?.totalPoints || 0;

            if (userFlights.length === 0) {
                return interaction.editReply({ content: `${user.tag} has no recorded flights.` });
            }

            const flightSummaries = userFlights
                .map(
                    (flight) =>
                        `✧ **${flight.callsign}** (${flight.aircraft}) from ${flight.departure} to ${flight.arrival}`
                )
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle(` `)
                .setDescription(`## Flight Summary for <@${user.id}> \n\n` + flightSummaries)
                .addFields({ name: "Total Flights", value: `${totalPoints}`, inline: true })
                .setImage(bannerUrl);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);

            // Ensure only one reply is sent
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: "Failed to retrieve flight data." });
            } else if (interaction.deferred) {
                await interaction.editReply({ content: "Failed to retrieve flight data." });
            }
        }
    },
};
