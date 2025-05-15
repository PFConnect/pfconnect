const { EmbedBuilder } = require("discord.js");
const { ICON, BANNER } = require("../config");
const { loadFlightData, loadGuildData } = require("../functions/api_utils");
const globalStatsCache = require("../utils/globalStatsCache");
const noFlightsData = require("../resources/noFlights.json");

module.exports = {
    data: {
        name: "stats",
        description: "Shows detailed stats for a specific user across all servers.",
        options: [
            {
                name: "user",
                type: 6,
                description: "The user to get the stats for.",
                required: false,
            },
        ],
    },

    async execute(interaction) {
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const guildId = interaction.guild.id;
        const userId = targetUser.id;

        await interaction.deferReply();

        try {
            // Ensure cache is fresh
            await globalStatsCache.updateCache();
            const guildData = await loadGuildData(guildId);
            if (!guildData) {
                return interaction.editReply({
                    content: "No guild data found for this server.",
                    ephemeral: true,
                });
            }

            // Get current server stats
            const userData = await loadFlightData(guildId);
            let currentServerStats = { flights: [], totalPoints: 0 };
            let hasLocalFlights = false;

            if (userData && userData[guildId]?.users?.[userId]) {
                currentServerStats = userData[guildId].users[userId];
                hasLocalFlights = currentServerStats.flights.length > 0;
            }

            const flights = currentServerStats.flights || [];
            const totalFlightsCurrentServer = flights.length;

            // Get global stats from cache
            const { globalStats, lastUpdated } = globalStatsCache.getPilotStats(userId);

            // Calculate current server favorites
            const aircraftCount = {};
            const destinationCount = {};
            const routeCount = {};

            flights.forEach((flight) => {
                aircraftCount[flight.aircraft] = (aircraftCount[flight.aircraft] || 0) + 1;
                destinationCount[flight.arrival] = (destinationCount[flight.arrival] || 0) + 1;
                const route = `${flight.departure} -> ${flight.arrival}`;
                routeCount[route] = (routeCount[route] || 0) + 1;
            });

            const favouriteAircraft = Object.keys(aircraftCount).reduce(
                (a, b) => (aircraftCount[a] > aircraftCount[b] ? a : b),
                "N/A"
            );
            const favouriteDestination = Object.keys(destinationCount).reduce(
                (a, b) => (destinationCount[a] > destinationCount[b] ? a : b),
                "N/A"
            );
            const favouriteRoute = Object.keys(routeCount).reduce(
                (a, b) => (routeCount[a] > routeCount[b] ? a : b),
                "N/A"
            );

            // Calculate server ranking
            let userServerRank = "N/A";
            let totalPilotsServer = 0;

            if (userData && userData[guildId]?.users) {
                const currentServerUsers = Object.entries(userData[guildId].users)
                    .map(([userId, userData]) => ({
                        userId,
                        totalFlights: userData.totalPoints || 0,
                    }))
                    .sort((a, b) => b.totalFlights - a.totalFlights);

                const rankIndex = currentServerUsers.findIndex((u) => u.userId === userId);
                userServerRank = rankIndex !== -1 ? rankIndex + 1 : "N/A";
                totalPilotsServer = currentServerUsers.length;
            }

            // Create embed
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `${targetUser.username}'s Statistics`,
                    iconURL: targetUser.displayAvatarURL(),
                })
                .setColor("#000000")
                .setThumbnail(targetUser.displayAvatarURL())
                .setImage(guildData.bannerUrl || BANNER);

            // Check if user has no stats at all
            const hasNoStats = !globalStats && !hasLocalFlights;

            if (hasNoStats) {
                const randomTitle = noFlightsData.titles[Math.floor(Math.random() * noFlightsData.titles.length)];

                // Get 3 unique random tips
                const randomTips = [];
                const tipsCopy = [...noFlightsData.tips];
                for (let i = 0; i < 3; i++) {
                    const randomIndex = Math.floor(Math.random() * tipsCopy.length);
                    randomTips.push(`• ${tipsCopy.splice(randomIndex, 1)[0]}`);
                }

                embed.setDescription(`**${randomTitle}**`).addFields({
                    name: "Flight School Tips",
                    value: randomTips.join("\n"),
                    inline: false,
                });
            } else {
                // Add all normal fields if they have stats
                embed.addFields(
                    {
                        name: "🏆 Global Ranking",
                        value: globalStats
                            ? `**#${globalStats.globalRank}** out of ${globalStats.totalPilots} pilots\n` +
                              `**${globalStats.totalFlights}** total Flights\n` +
                              `**${globalStats.servers.length}** servers flown in`
                            : "No global flight data available",
                        inline: false,
                    },
                    {
                        name: "🏅 Current Server Ranking",
                        value: hasLocalFlights
                            ? `**#${userServerRank}** out of ${totalPilotsServer} pilots\n` +
                              `**${totalFlightsCurrentServer}** flights in this server`
                            : "No flights yet on this server",
                        inline: false,
                    },
                    {
                        name: "🛫 Flight Preferences",
                        value: hasLocalFlights
                            ? `**Aircraft:** ${favouriteAircraft}\n` +
                              `**Destination:** ${favouriteDestination}\n` +
                              `**Route:** ${favouriteRoute}`
                            : "No flight preferences available",
                        inline: true,
                    }
                );

                // Add servers list if available
                if (globalStats?.servers?.length > 0) {
                    const serversWithCounts = globalStats.servers.map((server) => {
                        const flightCount = globalStatsCache.getServerFlightCount(userId, server.id);
                        return {
                            ...server,
                            flightCount,
                        };
                    });

                    serversWithCounts.sort((a, b) => b.flightCount - a.flightCount);

                    embed.addFields({
                        name: "🌍 Top Servers Flown In",
                        value:
                            serversWithCounts
                                .slice(0, 5)
                                .map((server) => `• ${server.name} (${server.flightCount} flights)`)
                                .join("\n") +
                            (serversWithCounts.length > 5 ? `\n...and ${serversWithCounts.length - 5} more` : ""),
                        inline: false,
                    });
                }

                // Add top pilot comparison if applicable
                if (globalStats) {
                    const topPilots = globalStatsCache.getTopPilots(1);
                    if (topPilots.length > 0 && topPilots[0].totalFlights > 0) {
                        const topPilot = topPilots[0];
                        const percentage = (globalStats.totalFlights / topPilot.totalFlights) * 100;

                        let percentageText;
                        if (percentage < 0.1) {
                            percentageText = "less than 0.1";
                        } else if (percentage < 1) {
                            percentageText = "less than 1";
                        } else {
                            percentageText = percentage.toFixed(1);
                        }

                        embed.addFields({
                            name: "🏅 Comparison to Top Pilot",
                            value: `You've flown ${percentageText}% of **#1**'s flights (${topPilot.totalFlights} total)`,
                            inline: true,
                        });
                    } else if (topPilots.length > 0 && globalStats.totalFlights === 0) {
                        embed.addFields({
                            name: "🏅 Comparison to Top Pilot",
                            value: `You haven't flown yet (Top pilot has ${topPilots[0].totalFlights} flights)`,
                            inline: true,
                        });
                    }
                }
            }

            // Add cache timestamp
            embed.setFooter({
                text: `Stats updated ${new Date(lastUpdated).toLocaleTimeString()}`,
                iconURL: ICON,
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in stats command:", error);
            await interaction.editReply({
                content: "An error occurred while gathering statistics.",
                ephemeral: true,
            });
        }
    },
};
