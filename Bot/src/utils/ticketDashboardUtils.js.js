const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { loadGuildData } = require("../functions/api_utils");

async function sendTicketDashboard(guild, channel, userId) {
    const guildData = await loadGuildData(guild.id);

    const embed = new EmbedBuilder()
        .setColor(guildData?.ticketColor || "#000000")
        .setTitle(guildData?.ticketTitle || "Ticket System")
        .setDescription(guildData?.ticketDescription || "Choose the topic of your ticket using the menu below.")
        .setImage(guildData?.bannerUrl || null);

    const ticketOptions = guildData?.ticketOptions || [
        {
            label: "Support",
            value: "support",
            description: "Create a support ticket.",
            emoji: "🔧",
        },
        {
            label: "Partnership",
            value: "partnership",
            description: "Create a partnership ticket.",
            emoji: "🤝",
        },
        {
            label: "Report",
            value: "report",
            description: "Create a report ticket.",
            emoji: "⚠️",
        },
    ];

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_category")
            .setPlaceholder("Select a category")
            .addOptions(
                ticketOptions.map((option) => ({
                    label: option.label,
                    value: option.value,
                    description: option.description,
                    emoji: option.emoji,
                }))
            )
    );

    await channel.send({ embeds: [embed], components: [row] });

    return { success: true, message: "Ticket dashboard created successfully" };
}

module.exports = { sendTicketDashboard };
