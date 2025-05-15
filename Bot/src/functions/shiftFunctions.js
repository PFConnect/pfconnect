const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadShiftData, loadShiftServerData, loadGuildData } = require("../functions/api_utils");

async function getBanner(guildId, type) {
    const { loadGuildData } = require("../functions/api_utils");
    const guildData = await loadGuildData(guildId);
    return (
        guildData?.shiftBanners?.[type] || `https://pflufthansavirtual.com/Pictures/pfc_${type.toLowerCase()}_line.png`
    );
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
}

function calculateActiveShiftTime(shifts, shiftId) {
    if (!shifts || !shifts.length) return 0;

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

// Handler for "My Shift Stats" button
async function handleMyShiftsButton(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code !== "InteractionAlreadyReplied") {
            throw error;
        }
    }

    try {
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        const shiftData = await loadShiftData(guildId, userId);
        const unix = Math.floor(Date.now() / 1000);

        if (!shiftData || !shiftData.shifts || shiftData.shifts.length === 0) {
            const noDataEmbed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:info:1350144143367602337> My Shift Statistics")
                .setDescription("You haven't completed any shifts yet.")
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields({
                    name: "<:compass:1350143858708582461> Get Started",
                    value: "Use `/shift_start` to begin tracking your work time.",
                })
                .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            return interaction.followUp({
                embeds: [noDataEmbed],
                ephemeral: true,
            });
        }

        // Check if there's an active shift
        const activeShift = shiftData.shifts
            .filter((s) => s.type === "start")
            .find((s) => !shiftData.shifts.some((e) => e.id === s.id && e.type === "end"));

        // Get completed shifts
        const completedShiftIds = [...new Set(shiftData.shifts.filter((s) => s.type === "end").map((s) => s.id))];

        // Calculate stats
        const totalShifts = completedShiftIds.length;
        const totalTime = shiftData.totalTime || 0;
        const averageTime = totalShifts > 0 ? totalTime / totalShifts : 0;

        // Find longest and shortest shifts
        let longestShiftTime = 0;
        let longestShiftId = null;
        let shortestShiftTime = Infinity;
        let shortestShiftId = null;

        completedShiftIds.forEach((shiftId) => {
            const shiftTime = calculateActiveShiftTime(shiftData.shifts, shiftId);

            if (shiftTime > longestShiftTime) {
                longestShiftTime = shiftTime;
                longestShiftId = shiftId;
            }

            if (shiftTime < shortestShiftTime) {
                shortestShiftTime = shiftTime;
                shortestShiftId = shiftId;
            }
        });

        // Find most recent shift
        const recentShiftId = completedShiftIds.length > 0 ? completedShiftIds[completedShiftIds.length - 1] : null;

        // Build embed
        const statsEmbed = new EmbedBuilder()
            .setColor("#000000")
            .setTitle("<:info:1350144143367602337> My Shift Statistics")
            .setDescription(`Shift statistics for <@${userId}>`)
            .setThumbnail(interaction.user.displayAvatarURL());

        // Add shift summary section
        statsEmbed.addFields({
            name: "<:cloud:1350143846822187039> Shift Summary",
            value: `Total Shifts: **${totalShifts}**
                   Total Time: **${formatTime(totalTime)}**
                   Average Shift: **${formatTime(averageTime)}**`,
        });

        // Add active shift info if exists
        if (activeShift) {
            const activeShiftStartTime = Math.floor(new Date(activeShift.timestamp).getTime() / 1000);
            const activeShiftDuration = calculateActiveShiftTime(shiftData.shifts, activeShift.id);

            // Check if currently paused
            const isPaused = shiftData.shifts.some(
                (s) =>
                    s.id === activeShift.id &&
                    s.type === "pause" &&
                    !shiftData.shifts.some(
                        (r) => r.id === s.id && r.type === "resume" && new Date(r.timestamp) > new Date(s.timestamp)
                    )
            );

            statsEmbed.addFields({
                name: "<:clock:1350143836906590391> Current Shift",
                value: `ID: \`${activeShift.id}\`
                       Started: <t:${activeShiftStartTime}:R>
                       Status: ${isPaused ? "<:stop:1350144631152574484> Paused" : "<:play:1350144468359053435> Active"}
                       Duration: **${formatTime(activeShiftDuration)}**`,
            });
        }

        // Add best shift info if exists
        if (longestShiftId) {
            statsEmbed.addFields({
                name: "<:idea:1350144132756013168> Notable Shifts",
                value: `Longest: \`${longestShiftId}\` (**${formatTime(longestShiftTime)}**)
                       Shortest: \`${shortestShiftId}\` (**${formatTime(shortestShiftTime)}**)
                       Recent: \`${recentShiftId}\``,
            });
        }

        // Add server ranking
        const serverData = await loadShiftServerData(guildId);
        if (serverData && Object.keys(serverData).length > 0) {
            const sortedUsers = Object.entries(serverData).sort(([, timeA], [, timeB]) => timeB - timeA);
            const userRank = sortedUsers.findIndex(([id]) => id === userId) + 1;
            const totalUsers = sortedUsers.length;

            if (userRank > 0) {
                statsEmbed.addFields({
                    name: "<:world:1350144698563559464> Server Ranking",
                    value: `Your Rank: **${userRank}** of ${totalUsers}
                           ${userRank <= 3 ? "\n🎉 Top Performer!" : ""}`,
                });
            }
        }

        statsEmbed
            .setImage(await getBanner(interaction.guild.id, "BLUE"))
            .setTimestamp()
            .setFooter({ text: `PFConnect • Shift System` });

        // Add buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("refresh_my_stats")
                .setLabel("Refresh Stats")
                .setStyle(ButtonStyle.Primary)
                .setEmoji("1350144536990584884")
        );

        await interaction.followUp({
            embeds: [statsEmbed],
            components: [row],
            ephemeral: true,
        });
    } catch (error) {
        console.error("Error handling my shifts button:", error);
        try {
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to load your shift statistics.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
                ephemeral: true,
            });
        } catch (followUpError) {
            console.error("Failed to send error message:", followUpError);
        }
    }
}

// Handler for "Refresh Leaderboard" button
async function handleRefreshLeaderboardButton(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code !== "InteractionAlreadyReplied") {
            throw error;
        }
    }

    try {
        const shiftCommand = interaction.client.application?.commands?.cache?.find((cmd) => cmd.name === "shifts");

        if (shiftCommand) {
            await interaction.guild.commands
                .fetch(shiftCommand.id)
                .then((command) => {
                    interaction.commandId = command.id;
                    interaction.commandName = "shifts";
                    return interaction.client.emit("interactionCreate", interaction);
                })
                .catch(async (error) => {
                    console.error("Failed to fetch command:", error);
                    await interaction.followUp({
                        content: "Failed to refresh leaderboard. Please use /shifts command directly.",
                        ephemeral: true,
                    });
                });
        } else {
            await interaction.followUp({
                content: "Shifts command not found. Please use /shifts command directly.",
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error("Error handling refresh leaderboard button:", error);
        try {
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to refresh the leaderboard.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
                ephemeral: true,
            });
        } catch (followUpError) {
            console.error("Failed to send error message:", followUpError);
        }
    }
}

// Handler for "Back to Leaderboard" button
async function handleBackToLeaderboardButton(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code !== "InteractionAlreadyReplied") {
            throw error;
        }
    }

    try {
        const commandName = "shifts";

        const syntheticInteraction = {
            ...interaction,
            commandName: commandName,
            options: {
                get: () => null,
                getSubcommand: () => null,
                getBoolean: () => null,
                getString: () => null,
                getInteger: () => null,
                getMember: () => null,
                getUser: () => null,
                getChannel: () => null,
                getRole: () => null,
                getMentionable: () => null,
                data: { options: [] },
            },
            isCommand: () => true,
        };

        interaction.client.emit("interactionCreate", syntheticInteraction);
    } catch (error) {
        console.error("Error handling back to leaderboard button:", error);
        try {
            await interaction.followUp({
                content: "Failed to return to leaderboard. Please use /shifts command directly.",
                ephemeral: true,
            });
        } catch (followUpError) {
            console.error("Failed to send error message:", followUpError);
        }
    }
}

async function handleRefreshActiveShiftsButton(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code !== "InteractionAlreadyReplied") {
            throw error;
        }
    }

    try {
        const shiftCommand = interaction.client.application?.commands?.cache?.find(
            (cmd) => cmd.name === "shifts_active"
        );

        if (shiftCommand) {
            await interaction.guild.commands
                .fetch(shiftCommand.id)
                .then((command) => {
                    interaction.commandId = command.id;
                    interaction.commandName = "shifts_active";
                    return interaction.client.emit("interactionCreate", interaction);
                })
                .catch(async (error) => {
                    console.error("Failed to fetch command:", error);
                    await interaction.followUp({
                        content: "Failed to refresh active shifts. Please use /shifts_active command directly.",
                        ephemeral: true,
                    });
                });
        } else {
            await interaction.followUp({
                content: "Active shifts command not found. Please use /shifts_active command directly.",
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error("Error handling refresh active shifts button:", error);
        try {
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to refresh active shifts.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
                ephemeral: true,
            });
        } catch (followUpError) {
            console.error("Failed to send error message:", followUpError);
        }
    }
}

async function handleRefreshGlobalLeaderboardButton(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code !== "InteractionAlreadyReplied") {
            throw error;
        }
    }

    try {
        // Clear the cache before refreshing
        const shiftsGlobalModule = require("../commands/shifts_global");
        shiftsGlobalModule.clearCache();

        const shiftCommand = interaction.client.application?.commands?.cache?.find(
            (cmd) => cmd.name === "shifts_global"
        );

        if (shiftCommand) {
            await interaction.guild.commands
                .fetch(shiftCommand.id)
                .then((command) => {
                    interaction.commandId = command.id;
                    interaction.commandName = "shifts_global";
                    return interaction.client.emit("interactionCreate", interaction);
                })
                .catch(async (error) => {
                    console.error("Failed to fetch command:", error);
                    await interaction.followUp({
                        content: "Failed to refresh global leaderboard. Please use /shifts_global command directly.",
                        ephemeral: true,
                    });
                });
        } else {
            await interaction.followUp({
                content: "Global shifts command not found. Please use /shifts_global command directly.",
                ephemeral: true,
            });
        }
    } catch (error) {
        console.error("Error handling refresh global leaderboard button:", error);
        try {
            await interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to refresh global leaderboard.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
                ephemeral: true,
            });
        } catch (followUpError) {
            console.error("Failed to send error message:", followUpError);
        }
    }
}

// Handler for "Refresh My Stats" button
async function handleRefreshMyStatsButton(interaction) {
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (error.code !== "InteractionAlreadyReplied") {
            throw error;
        }
    }

    await handleMyShiftsButton(interaction);
}

module.exports = {
    handleMyShiftsButton,
    handleRefreshLeaderboardButton,
    handleBackToLeaderboardButton,
    handleRefreshMyStatsButton,
    handleRefreshActiveShiftsButton,
    handleRefreshGlobalLeaderboardButton,
};
