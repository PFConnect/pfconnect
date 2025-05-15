const { EmbedBuilder } = require("discord.js");
const { loadGuildData } = require("../functions/api_utils");

module.exports = {
    data: {
        name: "showsetup",
        description: "Shows you everything you set in the Setup (Owner only).",
    },

    async execute(interaction) {
        try {
            const guildId = interaction.guild.id;
            const guildData = await loadGuildData(guildId); // now expects guildId
            const guildSettings = guildData || {};

            const { UNIVERSAL_ADMIN_IDS } = require("../config");
            if (
                interaction.user.id !== interaction.guild.ownerId &&
                !UNIVERSAL_ADMIN_IDS.includes(interaction.user.id)
            ) {
                return interaction.reply({
                    content: "Only the server owner can run this setup command!",
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor(guildSettings.welcomeColor || "#2f3136")
                .setTitle(`Server Setup Overview`)
                .setDescription("Here is the current configuration for your server.")
                .addFields(
                    {
                        name: "Welcome Channel",
                        value: `<#${guildSettings.welcomeChannel || "0"}>` || "Not set",
                        inline: true,
                    },
                    { name: "Welcome Title", value: guildSettings.welcomeTitle || "Not set", inline: true },
                    { name: "Welcome Description", value: guildSettings.welcomeDescription || "Not set", inline: true },
                    { name: "Welcome Footer", value: guildSettings.welcomeFooter || "Not set", inline: true },

                    { name: "Guide Title", value: guildSettings.guideTitle || "Not set", inline: true },
                    { name: "Guide Description", value: guildSettings.guideDescription || "Not set", inline: true },
                    { name: "Guide Footer", value: guildSettings.guideFooter || "Not set", inline: true },

                    {
                        name: "Rankup Channel",
                        value: `<#${guildSettings.rankupChannel || "0"}>` || "Not set",
                        inline: true,
                    },
                    { name: "Rankup Title", value: guildSettings.rankupTitle || "Not set", inline: true },
                    { name: "Rankup Description", value: guildSettings.rankupDescription || "Not set", inline: true },
                    { name: "Rankup Footer", value: guildSettings.rankupFooter || "Not set", inline: true },

                    {
                        name: "Ticket Category",
                        value: `<#${guildSettings.ticketCategory || "0"}>` || "Not set",
                        inline: true,
                    },
                    { name: "Ticket Title", value: guildSettings.ticketTitle || "Not set", inline: true },
                    { name: "Ticket Description", value: guildSettings.ticketDescription || "Not set", inline: true },
                    { name: "Ticket Footer", value: guildSettings.ticketFooter || "Not set", inline: true },

                    {
                        name: "Ticket Options",
                        value:
                            guildSettings.ticketOptions
                                ?.map((opt) => `${opt.emoji} **${opt.label}** – ${opt.description}`)
                                .join("\n") || "Not set",
                        inline: false,
                    },
                    {
                        name: "Ticket Counters",
                        value:
                            Object.entries(guildSettings.ticketCounter || {})
                                .map(([key, val]) => `**${key}**: ${val}`)
                                .join(" • ") || "Not set",
                        inline: false,
                    },
                    {
                        name: "Staff Roles",
                        value: guildSettings.staffRoles?.map((roleId) => `<@&${roleId}>`).join(", ") || "Not set",
                        inline: true,
                    },
                    {
                        name: "Pilot Roles",
                        value:
                            guildSettings.pilotRoles
                                ?.map((pilot) => `${pilot.flights} flights: <@&${pilot.role}>`)
                                .join("\n") || "Not set",
                        inline: true,
                    }
                );

            if (isValidUrl(guildSettings.bannerUrl)) {
                embed.setImage(guildSettings.bannerUrl);
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in showsetup command:", error);
            if (!interaction.replied) {
                await interaction.reply({
                    content: "An error occurred while processing your command.",
                    ephemeral: true,
                });
            }
        }
    },
};

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}
