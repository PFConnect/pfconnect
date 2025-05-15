const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadShiftData, loadShiftServerData } = require("../functions/api_utils");

async function getBanner(guildId, type) {
    const { loadGuildData } = require("../functions/api_utils");
    const guildData = await loadGuildData(guildId);
    return (
        guildData?.shiftBanners?.[type] || `https://pflufthansavirtual.com/Pictures/pfc_${type.toLowerCase()}_line.png`
    );
}

// Helper function to format milliseconds to HH:MM:SS
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
}

// Calculate active shift time including pause periods
function calculateActiveShiftTime(shifts, shiftId) {
    if (!shifts || !shifts.length) return 0;

    // Filter only events for this specific shift
    const shiftEvents = shifts.filter((s) => s.id === shiftId);
    if (!shiftEvents.length) return 0;

    // Get start event
    const startEvent = shiftEvents.find((s) => s.type === "start");
    if (!startEvent) return 0;

    let startTime = new Date(startEvent.timestamp).getTime();
    let endTime = null;
    let totalPausedTime = 0;
    let pauseStart = null;

    // Sort events by timestamp
    const sortedEvents = [...shiftEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate paused time and find end time if exists
    for (const event of sortedEvents) {
        if (event.type === "pause") {
            pauseStart = new Date(event.timestamp).getTime();
        } else if (event.type === "resume" && pauseStart) {
            const pauseEnd = new Date(event.timestamp).getTime();
            totalPausedTime += pauseEnd - pauseStart;
            pauseStart = null;
        } else if (event.type === "end") {
            endTime = new Date(event.timestamp).getTime();
        }
    }

    // If still paused, count from pause to now
    if (pauseStart) {
        totalPausedTime += Date.now() - pauseStart;
    }

    // Calculate total time
    const now = Date.now();
    const totalTimeMs = (endTime || now) - startTime;

    // Return active time (total minus paused)
    return Math.max(0, totalTimeMs - totalPausedTime);
}

// Function to check shift status (active, paused)
function getShiftStatus(shifts, shiftId) {
    if (!shifts || !shifts.length) return "unknown";

    const shiftEvents = shifts.filter((s) => s.id === shiftId);

    // Check if ended first
    if (shiftEvents.some((s) => s.type === "end")) {
        return "ended";
    }

    // Check if paused
    const pauseEvents = shiftEvents.filter((s) => s.type === "pause");
    const resumeEvents = shiftEvents.filter((s) => s.type === "resume");

    if (pauseEvents.length > resumeEvents.length) {
        return "paused";
    }

    return "active";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shifts_active")
        .setDescription("View all currently active shifts in this server"),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildId = interaction.guild.id;
            const serverData = await loadShiftServerData(guildId);

            if (Object.keys(serverData).length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:info:1350144143367602337> Active Shifts")
                            .setDescription("No shift data available for this server yet.")
                            .addFields({
                                name: "<:info:1350144143367602337> How to Start",
                                value: "Users can begin tracking shifts with `/shift_start`",
                            })
                            .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                            .setTimestamp()
                            .setFooter({ text: `PFConnect • Shift System` }),
                    ],
                });
            }

            // Collect all active shifts from users
            const activeShifts = [];

            for (const userId of Object.keys(serverData)) {
                try {
                    // Load user's detailed shift data
                    const userData = await loadShiftData(guildId, userId);

                    if (!userData.shifts || userData.shifts.length === 0) continue;

                    // Find active shifts (started but not ended)
                    const startedShifts = userData.shifts
                        .filter((s) => s.type === "start")
                        .filter((s) => !userData.shifts.some((e) => e.id === s.id && e.type === "end"));

                    // For each active shift, add to our list with details
                    for (const shift of startedShifts) {
                        const shiftId = shift.id;
                        const startTime = new Date(shift.timestamp).getTime();
                        const activeTime = calculateActiveShiftTime(userData.shifts, shiftId);
                        const status = getShiftStatus(userData.shifts, shiftId);

                        activeShifts.push({
                            userId,
                            shiftId,
                            startTime,
                            activeTime,
                            status,
                        });
                    }
                } catch (error) {
                    console.error(`Error processing shifts for user ${userId}:`, error);
                    // Continue with next user
                }
            }

            if (activeShifts.length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:info:1350144143367602337> Active Shifts")
                            .setDescription("There are no active shifts in this server right now.")
                            .addFields({
                                name: "<:play:1350144468359053435> Start a Shift",
                                value: "Use `/shift_start` to begin tracking your work time.",
                            })
                            .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                            .setTimestamp()
                            .setFooter({ text: `PFConnect • Shift System` }),
                    ],
                });
            }

            // Sort shifts by active time (descending)
            activeShifts.sort((a, b) => b.activeTime - a.activeTime);

            // Format active shifts list
            let activeShiftsText = "";

            activeShifts.forEach((shift, index) => {
                const startUnix = Math.floor(shift.startTime / 1000);
                const statusEmoji =
                    shift.status === "active" ? "<:play:1350144468359053435>" : "<:stop:1350144631152574484>";

                activeShiftsText += `${index + 1}. ${statusEmoji} <@${shift.userId}>\n`;
                activeShiftsText += `   • ID: \`${shift.shiftId}\`\n`;
                activeShiftsText += `   • Started: <t:${startUnix}:R>\n`;
                activeShiftsText += `   • Active: **${formatTime(shift.activeTime)}**\n`;
                activeShiftsText += `   • Status: **${
                    shift.status.charAt(0).toUpperCase() + shift.status.slice(1)
                }**\n\n`;
            });

            // Create embed
            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:play:1350144468359053435> Active Shifts")
                .setDescription(`There are currently **${activeShifts.length}** active shifts in this server.`)
                .addFields(
                    {
                        name: "<:clock:1350143836906590391> Active Shifts",
                        value: activeShiftsText || "No active shifts found.",
                    },
                    {
                        name: "<:idea:1350144132756013168> Shift Commands",
                        value: "`/shift_start` - Begin a new shift\n`/shift_pause` - Pause your shift\n`/shift_resume` - Resume your shift\n`/shift_end` - End your shift",
                    }
                )
                .setImage(await getBanner(interaction.guild.id, "GREEN"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            // Add refresh button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("refresh_active_shifts")
                    .setLabel("Refresh Active Shifts")
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji("1350144536990584884"),
                new ButtonBuilder()
                    .setCustomId("my_shifts")
                    .setLabel("My Shift Stats")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("1350144586563063822")
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error("Error fetching active shifts:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to load active shifts.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};
