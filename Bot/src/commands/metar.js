require("dotenv").config();
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { loadGuildData } = require("../functions/api_utils");
const { ICON } = require("../config");

module.exports = {
    data: {
        name: "metar",
        description: "Get the METAR and TAF for a specific Airport.",
        options: [
            {
                type: 3,
                name: "airport",
                description: "The ICAO code of the airport.",
                required: true,
            },
        ],
    },

    async execute(interaction) {
        const airport = interaction.options.getString("airport").toUpperCase();
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);
        const bannerUrl = guildData?.bannerUrl || "https://pflufthansavirtual.com/Fotos/pfc_banner.png";
        const apiKey = process.env.AVWX_API_KEY;

        const metarUrl = `https://avwx.rest/api/metar/${airport}?token=${apiKey}`;
        const tafUrl = `https://avwx.rest/api/taf/${airport}?token=${apiKey}`;

        try {
            const metarResponse = await fetch(metarUrl);
            if (!metarResponse.ok) throw new Error("Failed to fetch METAR data");
            const metarData = await metarResponse.json();

            const tafResponse = await fetch(tafUrl);
            if (!tafResponse.ok) throw new Error("Failed to fetch TAF data");
            const tafData = await tafResponse.json();

            const embed = new EmbedBuilder()
                .setAuthor({ name: "PFConnect", iconURL: ICON })
                .setColor("#000000")
                .setTitle(`METAR and TAF for ${airport}`)
                .setDescription(
                    `**METAR**\n${metarData.raw || "No METAR data available"}\n\n**TAF**\n${
                        tafData.raw || "No TAF data available"
                    }`
                )
                .setImage(bannerUrl)
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`decode_metar_${airport}`)
                    .setLabel("Decode METAR")
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error("Error executing command:", error);
            await interaction.reply({ content: "There was an error. Please try again later.", ephemeral: true });
        }
    },

    async handleButton(interaction) {
        const customId = interaction.customId;
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);
        const bannerUrl = guildData?.bannerUrl || "https://pflufthansavirtual.com/Fotos/pfc_banner.png";

        if (customId.startsWith("decode_metar_")) {
            const airport = customId.split("_")[2];
            const decodedmetarUrl = `https://avwx.rest/api/metar/${airport}?token=${process.env.AVWX_API_KEY}&options=summary`;

            try {
                const decodedMetarResponse = await fetch(decodedmetarUrl);
                if (!decodedMetarResponse.ok) throw new Error("Failed to fetch decoded METAR data");
                const decodedMetarData = await decodedMetarResponse.json();

                const metarSummary = decodedMetarData.summary || "No summary available";

                const updatedEmbed = new EmbedBuilder()
                    .setAuthor({ name: "PFConnect", iconURL: ICON })
                    .setColor("#000000")
                    .setTitle(`METAR and TAF for ${airport}`)
                    .setDescription(
                        `**METAR**\n${
                            decodedMetarData.raw || "No METAR data available"
                        }\n\n**Decoded METAR**\n${metarSummary}\n\n**TAF**\nNo TAF data available`
                    )
                    .setImage(bannerUrl)
                    .setFooter({
                        text: `Requested by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL(),
                    });

                await interaction.update({ embeds: [updatedEmbed], components: [] });
            } catch (error) {
                console.error("Error handling button interaction:", error);
                await interaction.reply({
                    content: "Failed to decode METAR data. Please try again later.",
                    ephemeral: true,
                });
            }
        }
    },
};
