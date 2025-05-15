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
    data: new SlashCommandBuilder().setName("shift_pause").setDescription("Pause your current shift"),
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
                            .setDescription("You don't have an active shift to pause.")
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

            // Check if already paused
            const isPaused = shiftData.shifts.some(
                (s) =>
                    s.id === activeShift.id &&
                    s.type === "pause" &&
                    !shiftData.shifts.some(
                        (r) => r.id === s.id && r.type === "resume" && new Date(r.timestamp) > new Date(s.timestamp)
                    )
            );

            if (isPaused) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:denied:1350143952275374080> Already Paused")
                            .setDescription("Your shift is already paused.")
                            .setThumbnail(interaction.user.displayAvatarURL())
                            .addFields({
                                name: "<:arrow:1350143788282286161> Next Steps",
                                value: "Use `/shift_resume` to continue your shift.",
                            })
                            .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                            .setTimestamp(),
                    ],
                });
            }

            const timestamp = new Date().toISOString();
            const unix = Math.floor(new Date(timestamp).getTime() / 1000);

            const shiftAction = {
                id: activeShift.id,
                type: "pause",
                timestamp,
            };

            // Save the pause action
            await saveShiftData(guildId, userId, shiftAction);

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:stop:1350144631152574484> Shift Paused")
                .setDescription(`Your shift \`${activeShift.id}\` has been paused.`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: "<:clock:1350143836906590391> Paused at",
                        value: `<t:${unix}:F>`,
                        inline: true,
                    },
                    {
                        name: "<:person:1350144442685718538> User",
                        value: `<@${userId}>`,
                        inline: true,
                    },
                    {
                        name: "<:idea:1350144132756013168> Available Commands",
                        value: "`/shift_resume` - Resume this shift\n`/shift_end` - End your shift",
                    }
                )
                .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error pausing shift:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to pause your shift.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};
