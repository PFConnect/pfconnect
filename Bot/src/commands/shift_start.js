const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { loadShiftData, saveShiftData, loadGuildData } = require("../functions/api_utils");

async function getBanner(guildId, type) {
    const guildData = await loadGuildData(guildId);
    return (
        guildData?.shiftBanners?.[type] || `https://pflufthansavirtual.com/Pictures/pfc_${type.toLowerCase()}_line.png`
    );
}

module.exports = {
    data: new SlashCommandBuilder().setName("shift_start").setDescription("Start a new shift"),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        try {
            const guildId = interaction.guild.id;
            const userId = interaction.user.id;
            const guildData = await loadGuildData(guildId);

            if (guildData?.shiftStaffOnly) {
                const member = await interaction.guild.members.fetch(userId);
                const isStaff = member.roles.cache.some((role) => guildData.staffRoles.includes(role.id));

                if (!isStaff) {
                    return interaction.editReply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor("#000000")
                                .setTitle("<:deny:1350143965927702628> Access Denied")
                                .setDescription("Shifts are currently restricted to staff members only.")
                                .setImage(await getBanner(guildId, "RED"))
                                .setTimestamp(),
                        ],
                    });
                }
            }

            // Check for existing active shift
            const existingShifts = await loadShiftData(guildId, userId);
            const hasActiveShift = existingShifts.shifts.some(
                (s) => s.type === "start" && !existingShifts.shifts.some((e) => e.id === s.id && e.type === "end")
            );

            if (hasActiveShift) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:deny:1350143965927702628> Active Shift Exists")
                            .setDescription(
                                "You already have an active shift. Please end it before starting a new one."
                            )
                            .setThumbnail(interaction.user.displayAvatarURL())
                            .addFields({
                                name: "📋 Next Steps",
                                value: "Use `/shift_end` to complete your current shift first.",
                            })
                            .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                            .setTimestamp(),
                    ],
                });
            }

            const shiftId = generateShiftId();
            const timestamp = new Date().toISOString();
            const unix = Math.floor(new Date(timestamp).getTime() / 1000);

            const shiftAction = {
                id: shiftId,
                type: "start",
                timestamp,
            };

            // Save the shift action
            await saveShiftData(guildId, userId, shiftAction);
            if (guildData?.shiftMaxLength) {
                const maxLengthMs = guildData.shiftMaxLength * 60 * 60 * 1000; // Convert hours to ms
                setTimeout(async () => {
                    try {
                        // Check if shift is still active
                        const currentData = await loadShiftData(guildId, userId);
                        const isStillActive = currentData.shifts.some(
                            (s) =>
                                s.id === shiftId &&
                                s.type === "start" &&
                                !currentData.shifts.some((e) => e.id === shiftId && e.type === "end")
                        );

                        if (isStillActive) {
                            const endAction = {
                                id: shiftId,
                                type: "end",
                                timestamp: new Date().toISOString(),
                                autoEnded: true,
                            };
                            await saveShiftData(guildId, userId, endAction);

                            // Notify user if possible
                            const user = await interaction.client.users.fetch(userId);
                            user.send({
                                embeds: [
                                    new EmbedBuilder()
                                        .setColor("#000000")
                                        .setTitle("Shift Automatically Ended")
                                        .setDescription(
                                            `Your shift was automatically ended after reaching the maximum length of ${guildData.shiftMaxLength} hours.`
                                        )
                                        .setImage(await getBanner(guildId, "ORANGE"))
                                        .setTimestamp(),
                                ],
                            }).catch(() => {}); // Ignore if DM fails
                        }
                    } catch (error) {
                        console.error("Error auto-ending shift:", error);
                    }
                }, maxLengthMs);
            }

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:play:1350144468359053435> Shift Started")
                .setDescription(`Your shift has started with ID: \`${shiftId}\``)
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: "<:clock:1350143836906590391> Started at", value: `<t:${unix}:F>`, inline: true },
                    { name: "<:person:1350144442685718538> User", value: `<@${userId}>`, inline: true },
                    {
                        name: "<:idea:1350144132756013168> Available Commands",
                        value: "`/shift_pause` - Pause your shift\n`/shift_end` - End your shift",
                    }
                )
                .setImage(await getBanner(interaction.guild.id, "GREEN"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            if (guildData?.shiftMaxLength) {
                embed.addFields({
                    name: "⏳ Maximum Length",
                    value: `This shift will automatically end after ${guildData.shiftMaxLength} hours.`,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error starting shift:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to start your shift.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};

function generateShiftId() {
    return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}
