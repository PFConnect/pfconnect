// commands/serverstats.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ICON, BANNER } = require("../config");
const { loadFlightData, loadGuildData } = require("../functions/api_utils");
const globalStatsCache = require("../utils/globalStatsCache");

module.exports = {
    data: {
        name: "serverstats",
        description: "Shows detailed statistics about this server's flight activity.",
    },

    async execute(interaction) {
        const guildId = interaction.guild.id;

        await interaction.deferReply();

        try {
            // Ensure cache is fresh
            await globalStatsCache.updateCache();

            // Load server data
            const guildData = await loadGuildData(guildId);
            if (!guildData) {
                return interaction.editReply({
                    content: "No data found for this server.",
                    ephemeral: true,
                });
            }

            // Load flight data
            const flightData = await loadFlightData(guildId);
            if (!flightData || !flightData[guildId]?.users) {
                return interaction.editReply({
                    content: "No flight data found for this server.",
                    ephemeral: true,
                });
            }

            const serverUsers = flightData[guildId].users;
            const totalPilots = Object.keys(serverUsers).length;

            // Calculate total flights
            let totalFlights = 0;
            const pilots = [];

            for (const [userId, userData] of Object.entries(serverUsers)) {
                totalFlights += userData.flights.length;
                pilots.push({
                    userId,
                    flights: userData.flights.length,
                    points: userData.totalPoints || 0,
                });
            }

            // Sort pilots by flights (descending)
            pilots.sort((a, b) => b.flights - a.flights);

            // Get top 3 pilots
            const topPilots = pilots.slice(0, 3);

            // Get server's global ranking based on flight count
            const allServersStats = globalStatsCache.cache.serverStats;
            let serverGlobalRank = "N/A";
            let totalServers = 0;
            let topServerFlights = 0;

            if (allServersStats) {
                totalServers = Object.keys(allServersStats).length;

                // Create array of servers sorted by flight count
                const sortedServers = Object.entries(allServersStats)
                    .map(([id, stats]) => {
                        const serverFlights = Object.values(globalStatsCache.cache.userServerFlights).reduce(
                            (sum, userFlights) => sum + (userFlights[id] || 0),
                            0
                        );
                        return {
                            id,
                            flightCount: serverFlights,
                            ...stats,
                        };
                    })
                    .sort((a, b) => b.flightCount - a.flightCount);

                const rankIndex = sortedServers.findIndex((s) => s.id === guildId);
                if (rankIndex !== -1) {
                    serverGlobalRank = rankIndex + 1;
                    topServerFlights = sortedServers[0]?.flightCount || 0;
                }
            }

            // Calculate most popular aircraft and routes
            const aircraftCount = {};
            const routeCount = {};

            for (const userData of Object.values(serverUsers)) {
                for (const flight of userData.flights) {
                    aircraftCount[flight.aircraft] = (aircraftCount[flight.aircraft] || 0) + 1;
                    const route = `${flight.departure} → ${flight.arrival}`;
                    routeCount[route] = (routeCount[route] || 0) + 1;
                }
            }

            const popularAircraft =
                Object.entries(aircraftCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([aircraft, count]) => `${aircraft} (${count})`)
                    .join("\n") || "No data";

            const popularRoutes =
                Object.entries(routeCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([route, count]) => `${route} (${count})`)
                    .join("\n") || "No data";

            // Create embed
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `${interaction.guild.name} Statistics`,
                    iconURL: interaction.guild.iconURL(),
                })
                .setColor("#000000")
                .setThumbnail(interaction.guild.iconURL())
                .setImage(guildData.bannerUrl || BANNER)
                .addFields(
                    {
                        name: "📊 General Stats",
                        value: `**Total Pilots:** ${totalPilots}\n` + `**Total Flights:** ${totalFlights}`,
                        inline: true,
                    },
                    {
                        name: "🏆 Global Ranking",
                        value:
                            serverGlobalRank !== "N/A"
                                ? `Ranked **#${serverGlobalRank}** of ${totalServers} servers\n` +
                                  `Based on flight count`
                                : "Global ranking not available",
                        inline: true,
                    },
                    {
                        name: "🛫 Popular Aircraft",
                        value: popularAircraft,
                        inline: false,
                    },
                    {
                        name: "🌍 Popular Routes",
                        value: popularRoutes,
                        inline: false,
                    }
                );

            // Add top pilots section if available
            if (topPilots.length > 0) {
                let topPilotsText = "";

                for (let i = 0; i < topPilots.length; i++) {
                    try {
                        const user = await interaction.client.users.fetch(topPilots[i].userId);
                        topPilotsText += `**${i + 1}.** ${user.username} - ${topPilots[i].flights} flights\n`;
                    } catch {
                        topPilotsText += `**${i + 1}.** <@${topPilots[i].userId}> - ${topPilots[i].flights} flights\n`;
                    }
                }

                embed.addFields({
                    name: "👑 Top Pilots",
                    value: topPilotsText,
                    inline: false,
                });
            }

            // Add comparison to top server if available
            if (serverGlobalRank !== "N/A" && serverGlobalRank > 1 && topServerFlights > 0) {
                const percentage = (totalFlights / topServerFlights) * 100;
                embed.addFields({
                    name: "🏅 Comparison to #1 Server",
                    value:
                        `This server has ${percentage.toFixed(1)}% of the #1 server's flights\n` +
                        `(${topServerFlights} flights)`,
                    inline: true,
                });
            }

            // Add last updated timestamp
            embed.setFooter({
                text: `Stats updated ${new Date(globalStatsCache.cache.lastUpdated).toLocaleTimeString()}`,
                iconURL: ICON,
            });

            // Create refresh button
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`serverstats_refresh_${Date.now()}`)
                    .setLabel(" Refresh")
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("1350144536990584884")
            );

            await interaction.editReply({
                embeds: [embed],
                components: [row],
            });
        } catch (error) {
            console.error("Error in serverstats command:", error);
            await interaction.editReply({
                content: "An error occurred while gathering server statistics.",
                ephemeral: true,
            });
        }
    },

    async handleButton(interaction) {
        if (interaction.customId.startsWith("serverstats_refresh_")) {
            await this.execute(interaction);
        }
    },
};
