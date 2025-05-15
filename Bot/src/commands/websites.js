const { EmbedBuilder } = require("discord.js");
const { loadGuildData } = require("../functions/api_utils");
const { ICON } = require("../config");

module.exports = {
    data: {
        name: "websites",
        description: "Get all of the official PFConnect Websites.",
    },
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor("#000000")
            .setAuthor({ name: "PFConnect", iconURL: ICON })
            .setTitle("Websites of PFConnect")
            .setDescription(
                `
                **PFConnect** - https://pfconnect.online

                **PFConnect Dev** - https://dev.pfconnect.online

                **PFConnect Charts** - https://charts.pfconnect.online

                **PFConnect API** - https://api.pfconnect.online

                **PFConnect API v2** - https://api-v2.pfconnect.online

                **PFConnect CD** - https://cd.pfconnect.online
                
                **PFConnect Status** - https://status.pfconnect.online

                **PFConnect Login** - https://login.pfconnect.online

                **PFConnect Logout** - https://logout.pfconnect.online
            `
            )
            .setImage("https://pflufthansavirtual.com/Fotos/pfc_banner.png");

        await interaction.reply({ embeds: [embed] });
    },
};
