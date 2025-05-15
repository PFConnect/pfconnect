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
    data: new SlashCommandBuilder().setName("shift_resume").setDescription("Resume your paused shift"),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;

            // Get current shift data
            const shiftData = await loadShiftData(guildId, userId);

            // Find the most recent paused shift
            const pausedShift = shiftData.shifts
                .filter((s) => s.type === "pause")
                .find(
                    (s) =>
                        !shiftData.shifts.some(
                            (r) => r.id === s.id && r.type === "resume" && new Date(r.timestamp) > new Date(s.timestamp)
                        )
                );

            if (!pausedShift) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:questionmark:1350144523120021574> No Paused Shift")
                            .setDescription("You don't have a paused shift to resume.")
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
            const unix = Math.floor(new Date(timestamp).getTime() / 1000);

            const shiftAction = {
                id: pausedShift.id,
                type: "resume",
                timestamp,
            };

            // Save the resume action
            await saveShiftData(guildId, userId, shiftAction);

            // Get the start timestamp for reference
            const startAction = shiftData.shifts.find((s) => s.id === pausedShift.id && s.type === "start");
            const startTime = startAction ? Math.floor(new Date(startAction.timestamp).getTime() / 1000) : null;

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:play:1350144468359053435> Shift Resumed")
                .setDescription(`Your shift \`${pausedShift.id}\` has been resumed.`)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: "<:clock:1350143836906590391> Resumed at",
                        value: `<t:${unix}:F>`,
                        inline: true,
                    },
                    {
                        name: "<:person:1350144442685718538> User",
                        value: `<@${userId}>`,
                        inline: true,
                    }
                );

            if (startTime) {
                embed.addFields({
                    name: "<:reload:1350144536990584884> Shift Info",
                    value: `Started: <t:${startTime}:R>\nCurrent status: Active`,
                });
            }

            embed
                .addFields({
                    name: "<:idea:1350144132756013168> Available Commands",
                    value: "`/shift_pause` - Pause this shift again\n`/shift_end` - End your shift",
                })
                .setImage(await getBanner(interaction.guild.id, "GREEN"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error resuming shift:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to resume your shift.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};
