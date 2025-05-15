const { EmbedBuilder } = require("discord.js");
const { loadGuildData } = require("../functions/api_utils");

module.exports = {
    data: {
        name: "help",
        description: "Get all available commands for the PFConnect Bot.",
    },
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);

        const embed = new EmbedBuilder()
            .setColor("#000000")
            .setTitle("Help - All Available Commands")
            .setDescription(
                `
                **🧾 General**
                > \`/help\`, \`/ping\`, \`/guide\`, \`/flightlog\`

                **⚙️ Setup**
                > \`/setup\`, \`/showsetup\`, \`/servers\`

                **👥 Roles & Users**
                > \`/roles\`, \`/myroles\`, \`/leaderboard\`, \`/global-leaderboard\`, \`/stats\`, \`/pilots\`

                **🎫 Tickets**
                > \`/add\`, \`/close\`, \`/remove\`, \`/closerequest\`, \`/transcript\`, \`/ticket_ban\`, \`/ticket_unban\`

                **🤝 Partnership & Tools**
                > \`/pfcharts\`, \`/uptime\`, \`/websites\`
            `
            )
            .setImage(guildData?.bannerUrl || "https://pflufthansavirtual.com/Fotos/pfc_banner.png");

        await interaction.reply({ embeds: [embed] });
    },
};
