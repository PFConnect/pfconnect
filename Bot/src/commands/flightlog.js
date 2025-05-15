const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { handleFlightLog } = require("../functions/flightlogFunctions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("flightlog")
        .setDescription("Log a flight into the system.")
        .addStringOption((option) =>
            option.setName("callsign").setDescription("Your flight callsign.").setRequired(true)
        )
        .addStringOption((option) => option.setName("aircraft").setDescription("Type of aircraft.").setRequired(true))
        .addStringOption((option) =>
            option.setName("departure").setDescription("Departure airport (e.g., MPDC, EGKK)").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("arrival").setDescription("Arrival airport (e.g., MPDC, EGKK)").setRequired(true)
        )
        .addIntegerOption((option) =>
            option.setName("altitude").setDescription("Cruising altitude in feet (ft).").setRequired(true)
        )
        .addStringOption((option) =>
            option.setName("remark").setDescription("A remark or your flight route.").setRequired(true)
        )
        .addAttachmentOption((option) =>
            option.setName("screenshot").setDescription("A screenshot to log the flight.").setRequired(true)
        ),
    async execute(interaction) {
        await handleFlightLog(interaction);
    },
};
