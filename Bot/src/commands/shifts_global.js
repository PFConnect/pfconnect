const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadShiftServerData } = require("../functions/api_utils");

async function getBanner(guildId, type) {
    const { loadGuildData } = require("../functions/api_utils");
    const guildData = await loadGuildData(guildId);
    return (
        guildData?.shiftBanners?.[type] || `https://pflufthansavirtual.com/Pictures/pfc_${type.toLowerCase()}_line.png`
    );
}
// Cache for global shift data
const globalShiftCache = {
    data: null,
    lastUpdated: 0,
    cacheTime: 3600000, // 1 hour cache validity in milliseconds
};

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

// Function to collect shift data from all guilds
async function collectGlobalShiftData(client) {
    // Check cache first
    const now = Date.now();
    if (globalShiftCache.data && now - globalShiftCache.lastUpdated < globalShiftCache.cacheTime) {
        return globalShiftCache.data;
    }

    const allGuilds = client.guilds.cache;
    const globalData = {};

    // Process each guild
    for (const [guildId, guild] of allGuilds) {
        try {
            const serverData = await loadShiftServerData(guildId);

            // Merge server data into global data
            for (const [userId, time] of Object.entries(serverData)) {
                if (!globalData[userId]) {
                    globalData[userId] = time;
                } else {
                    globalData[userId] += time;
                }
            }
        } catch (error) {
            console.error(`Error loading data for guild ${guildId}:`, error);
            // Continue with next guild on error
        }
    }

    // Update cache
    globalShiftCache.data = globalData;
    globalShiftCache.lastUpdated = now;

    return globalData;
}

// Function to get user info for leaderboard display
async function getUserInfo(client, userId) {
    try {
        const user = await client.users.fetch(userId);
        return {
            id: userId,
            tag: user.tag,
            displayName: user.displayName || user.username,
            avatarURL: user.displayAvatarURL(),
        };
    } catch (error) {
        console.error(`Error fetching user ${userId}:`, error);
        return {
            id: userId,
            tag: "Unknown User",
            displayName: "Unknown User",
            avatarURL: null,
        };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("shifts_global")
        .setDescription("View global shift leaderboard across all servers"),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const client = interaction.client;
            const globalShiftData = await collectGlobalShiftData(client);

            if (Object.keys(globalShiftData).length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:info:1350144143367602337> Global Shift Leaderboard")
                            .setDescription("No shift data available across any servers yet.")
                            .addFields({
                                name: "<:idea:1350144132756013168> How to Start",
                                value: "Users can begin tracking shifts with `/shift_start`",
                            })
                            .setImage(await getBanner(interaction.guild.id, "BLUE"))
                            .setTimestamp()
                            .setFooter({ text: `PFConnect • Global Shift System` }),
                    ],
                });
            }

            // Sort users by total time (descending)
            const sortedUsers = Object.entries(globalShiftData).sort(([, timeA], [, timeB]) => timeB - timeA);

            // Create the leaderboard with detailed info for top 3
            const top3 = sortedUsers.slice(0, 3);
            const otherUsers = sortedUsers.slice(3, 10);

            // Get user information for top 3
            const top3UserInfo = await Promise.all(top3.map(([userId]) => getUserInfo(client, userId)));

            // Build embed
            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:world:1350144698563559464> Global Shift Leaderboard")
                .setDescription("Statistics for shifts across all servers");

            // Add top 3 users with more details
            if (top3.length > 0) {
                const topEmojis = ["🥇", "🥈", "🥉"];

                embed.addFields({
                    name: "<:crown:1350143941340696686> Top Contributors",
                    value: top3
                        .map(([userId, time], index) => {
                            const user = top3UserInfo[index];
                            return `${topEmojis[index]} <@${userId}> - **${formatTime(time)}**`;
                        })
                        .join("\n"),
                });
            }

            // Add remaining top 10 users
            if (otherUsers.length > 0) {
                embed.addFields({
                    name: "<:group:1350144096957632665> Leaderboard",
                    value: otherUsers
                        .map(([userId, time], index) => {
                            return `${index + 4}. <@${userId}> - **${formatTime(time)}**`;
                        })
                        .join("\n"),
                });
            }

            // Calculate global stats
            const totalUsers = Object.keys(globalShiftData).length;
            const totalTimeMs = Object.values(globalShiftData).reduce((sum, time) => sum + time, 0);
            const totalHours = totalTimeMs / 3600000;
            const avgTime = totalUsers > 0 ? totalTimeMs / totalUsers : 0;

            embed.addFields({
                name: "<:info:1350144143367602337> Global Statistics",
                value: `<:group:1350144096957632665> Total Users: **${totalUsers}**
                       <:clock:1350143836906590391> Total Hours: **${totalHours.toFixed(2)}**
                       <:idea:1350144132756013168> Average Time: **${formatTime(avgTime)}**
                       <:reload:1350144536990584884> Last Updated: <t:${Math.floor(
                           globalShiftCache.lastUpdated / 1000
                       )}:R>`,
            });

            embed
                .setImage(await getBanner(interaction.guild.id, "BLUE"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Global Shift System • Data cached for 1 hour` });

            // Add refresh button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("refresh_global_leaderboard")
                    .setLabel("Refresh Global Leaderboard")
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
            console.error("Error fetching global shift leaderboard:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to load global shift leaderboard.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },

    // Method to clear cache programmatically if needed
    clearCache() {
        globalShiftCache.data = null;
        globalShiftCache.lastUpdated = 0;
        return true;
    },
};
