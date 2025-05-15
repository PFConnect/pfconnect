const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadShiftServerData } = require("../functions/api_utils");

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

module.exports = {
    data: new SlashCommandBuilder().setName("shifts").setDescription("View shift leaderboard for this server"),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildId = interaction.guild.id;
            const shiftData = await loadShiftServerData(guildId);
            const unix = Math.floor(Date.now() / 1000);

            if (Object.keys(shiftData).length === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor("#000000")
                            .setTitle("<:info:1350144143367602337> Shift Leaderboard")
                            .setDescription("No shift data available for this server yet.")
                            .addFields({
                                name: "<:idea:1350144132756013168> How to Start",
                                value: "Users can begin tracking shifts with `/shift_start`",
                            })
                            .setImage(await getBanner(interaction.guild.id, "ORANGE"))
                            .setTimestamp()
                            .setFooter({ text: `PFConnect • Shift System` }),
                    ],
                });
            }

            // Sort users by total time (descending)
            const sortedUsers = Object.entries(shiftData).sort(([, timeA], [, timeB]) => timeB - timeA);

            // Create the leaderboard with emojis for top positions
            let leaderboardText = "";
            sortedUsers.slice(0, 10).forEach(([userId, time], index) => {
                const formattedTime = formatTime(time);
                let position = "";

                // Add medal emojis for top 3
                if (index === 0) position = "🥇 ";
                else if (index === 1) position = "🥈 ";
                else if (index === 2) position = "🥉 ";
                else position = `${index + 1}. `;

                leaderboardText += `${position}<@${userId}> - **${formattedTime}**\n`;
            });

            // Calculate server stats
            const totalUsers = Object.keys(shiftData).length;
            const totalHours = Object.values(shiftData).reduce((sum, time) => sum + time, 0) / 3600000;
            const topUser = sortedUsers.length > 0 ? sortedUsers[0][0] : null;

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("<:info:1350144143367602337> Shift Leaderboard")
                .setDescription(leaderboardText)
                .addFields(
                    {
                        name: "<:info:1350144143367602337> Server Statistics",
                        value: `<:group:1350144096957632665> Active Users: ${totalUsers}\n<:clock:1350143836906590391> Total Hours: ${totalHours.toFixed(
                            2
                        )}\n<:crown:1350143941340696686> Top Contributor: ${topUser ? `<@${topUser}>` : "None"}`,
                    },
                    {
                        name: "<:idea:1350144132756013168> Available Commands",
                        value: "`/shift_start` - Begin a new shift\n`/shift_end` - End your active shift",
                    }
                )
                .setImage(await getBanner(interaction.guild.id, "GREEN"))
                .setTimestamp()
                .setFooter({ text: `PFConnect • Shift System` });

            // Add buttons for potential refresh and personal stats
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId("refresh_leaderboard")
                    .setLabel("Refresh Leaderboard")
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
            console.error("Error fetching shift leaderboard:", error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#000000")
                        .setTitle("<:deny:1350143965927702628> Error")
                        .setDescription("Failed to load shift leaderboard.")
                        .addFields({ name: "Error Details", value: "The server couldn't process your request." })
                        .setImage(await getBanner(interaction.guild.id, "RED"))
                        .setTimestamp(),
                ],
            });
        }
    },
};
