const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { loadShiftData, saveShiftData } = require("../functions/api_utils");

async function getBanner(guildId, type) {
    const { loadGuildData } = require("../functions/api_utils");
    const guildData = await loadGuildData(guildId);
    return (
        guildData?.shiftBanners?.[type] || `https://pflufthansavirtual.com/Pictures/pfc_${type.toLowerCase()}_line.png`
    );
}

module.exports = {
    data: new SlashCommandBuilder().setName("shift_end").setDescription("End your current shift"),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // Get current shift data
            const shiftData = await loadShiftData(guildId, userId);

            // Find the most recent active shift that hasn't been ended
            const activeShift = shiftData.shifts
                .filter((s) => s.type === "start")
                .find((s) => !shiftData.shifts.some((e) => e.id === s.id && e.type === "end"));

            if (!activeShift) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:deny:1350143965927702628> No Active Shift")
                            .setDescription("You don't have an active shift to end.")
                            .setThumbnail(interaction.user.displayAvatarURL())
                            .addFields({
                                name: "<:arrow:1350143788282286161> Next Steps",
                                value: "Use `/shift_start` to begin a new shift.",
                            })
                            .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                            .setTimestamp(),
                    ],
                });
            }

            const timestamp = new Date().toISOString();
            const startUnix = Math.floor(new Date(activeShift.timestamp).getTime() / 1000);
            const endUnix = Math.floor(new Date(timestamp).getTime() / 1000);

            const shiftAction = {
                id: activeShift.id,
                type: "end",
                timestamp,
            };

            // Save the end action
            await saveShiftData(guildId, userId, shiftAction);

            // Get updated data to calculate total time
            const updatedData = await loadShiftData(guildId, userId);
            const totalTime = updatedData.totalTime;

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:accept2:1350143752114536549> Shift Ended")
                .setDescription(`Your shift \`${activeShift.id}\` has been completed.`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: "<:play:1350144468359053435> Started at",
                        value: `<t:${startUnix}:F>`,
                        inline: true,
                    },
                    {
                        name: "<:stop:1350144631152574484> Ended at",
                        value: `<t:${endUnix}:F>`,
                        inline: true,
                    },
                    {
                        name: "<:idea:1350144132756013168> Total Time",
                        value: formatTime(totalTime),
                        inline: false,
                    },
                    {
                        name: "<:info:1350144143367602337> Statistics",
                        value: `Total shifts completed: ${updatedData.shifts.filter((s) => s.type === "end").length}`,
                    }
                )
                .setImage(await getBanner(interaction.guild.id, "RED"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error ending shift:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to end your shift.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
}
