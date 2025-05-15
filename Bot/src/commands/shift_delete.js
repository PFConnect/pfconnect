const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { deleteShiftData, loadGuildData } = require("../functions/api_utils");

async function getBanner(guildId, type) {
    const guildData = await loadGuildData(guildId);
    return (
        guildData?.shiftBanners?.[type] || `https://pflufthansavirtual.com/Pictures/pfc_${type.toLowerCase()}_line.png`
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shift_delete")
        .setDescription("Delete a shift by ID (Admin only)")
        .addStringOption((option) =>
            option.setName("shift_id").setDescription("The ID of the shift to delete").setRequired(true)
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Check permissions
            const { UNIVERSAL_ADMIN_IDS } = require("../config");
            const member = await interaction.guild.members.fetch(interaction.user.id);

            if (
                interaction.user.id !== interaction.guild.ownerId &&
                !UNIVERSAL_ADMIN_IDS.includes(interaction.user.id) &&
                !member.permissions.has("Administrator")
            ) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:deny:1350143965927702628> Permission Denied")
                            .setDescription("Only server owners, admins, or universal admins can delete shifts.")
                            .setImage(await getBanner(interaction.guild.id, "RED"))
                            .setTimestamp(),
                    ],
                });
            }

            const shiftId = interaction.options.getString("shift_id");
            const guildId = interaction.guild.id;

            const result = await deleteShiftData(guildId, shiftId);

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:accept2:1350143752114536549> Shift Deleted")
                        .setDescription(`Successfully deleted shift \`${shiftId}\``)
                        .addFields(
                            {
                                name: "Deleted Actions",
                                value: `${result.deletedCount}`,
                                inline: true,
                            },
                            {
                                name: "Affected Users",
                                value: `${result.affectedUsers}`,
                                inline: true,
                            }
                        )
                        .setImage(await getBanner(interaction.guild.id, "GREEN"))
                        .setTimestamp()
                        .setFooter({ text: `PFConnect • Shift System` }),
                ],
            });
        } catch (error) {
            console.error("Error deleting shift:", error);

            let errorMessage = "Failed to delete the shift.";
            if (error.message.includes("404")) {
                errorMessage = `Shift ID \`${interaction.options.getString("shift_id")}\` not found.`;
            }

            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription(errorMessage)
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};
