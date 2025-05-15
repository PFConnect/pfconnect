const { loadFlightData } = require("../functions/api_utils");
const client = require("../clientInstance");

class GlobalStatsCache {
    constructor() {
        this.cache = {
            lastUpdated: 0,
            allPilots: [],
            serverStats: {},
            rankings: {},
            userServerFlights: {},
        };
        this.CACHE_TTL = 60 * 60 * 1000;
        this.updateInProgress = false;
    }

    async updateCache() {
        if (this.updateInProgress) return;
        this.updateInProgress = true;

        try {
            const now = Date.now();
            if (now - this.cache.lastUpdated < this.CACHE_TTL) {
                return;
            }

            console.log("Updating global stats cache...");
            const allGuilds = client.guilds.cache;
            const newCache = {
                lastUpdated: now,
                allPilots: [],
                serverStats: {},
                rankings: {},
                userServerFlights: {},
            };

            for (const [guildId, guild] of allGuilds) {
                try {
                    const guildFlightData = await loadFlightData(guildId);
                    if (guildFlightData && guildFlightData[guildId]?.users) {
                        newCache.serverStats[guildId] = {
                            name: guild.name,
                            icon: guild.iconURL(),
                            memberCount: guild.memberCount,
                        };

                        for (const [userId, userData] of Object.entries(guildFlightData[guildId].users)) {
                            const existingUser = newCache.allPilots.find((u) => u.userId === userId);
                            if (existingUser) {
                                existingUser.totalFlights += userData.totalPoints || 0;
                                existingUser.servers.add(guildId);
                            } else {
                                newCache.allPilots.push({
                                    userId,
                                    totalFlights: userData.totalPoints || 0,
                                    servers: new Set([guildId]),
                                });
                            }
                            if (!newCache.userServerFlights[userId]) {
                                newCache.userServerFlights[userId] = {};
                            }
                            newCache.userServerFlights[userId][guildId] = userData.flights.length;
                        }
                    }
                } catch (error) {
                    console.error(`Error loading flight data for guild ${guildId}:`, error);
                }
            }

            newCache.allPilots.sort((a, b) => b.totalFlights - a.totalFlights);

            newCache.allPilots.forEach((pilot, index) => {
                newCache.rankings[pilot.userId] = {
                    globalRank: index + 1,
                    totalPilots: newCache.allPilots.length,
                    servers: Array.from(pilot.servers),
                };
            });

            this.cache = newCache;
            console.log("Global stats cache updated successfully");
        } catch (error) {
            console.error("Error updating global stats cache:", error);
        } finally {
            this.updateInProgress = false;
        }
    }

    getPilotStats(userId) {
        const ranking = this.cache.rankings[userId] || null;
        const pilot = this.cache.allPilots.find((p) => p.userId === userId);

        const globalStats = ranking
            ? {
                  globalRank: ranking.globalRank,
                  totalPilots: ranking.totalPilots,
                  totalFlights: pilot?.totalFlights || 0,
                  servers: ranking.servers.map((guildId) => ({
                      id: guildId,
                      name: this.cache.serverStats[guildId]?.name || "Unknown Server",
                      icon: this.cache.serverStats[guildId]?.icon || null,
                  })),
              }
            : null;

        return {
            globalStats,
            lastUpdated: this.cache.lastUpdated,
        };
    }

    getTopPilots(limit = 10) {
        return this.cache.allPilots.slice(0, limit).map((pilot) => ({
            userId: pilot.userId,
            totalFlights: pilot.totalFlights,
            globalRank: this.cache.rankings[pilot.userId]?.globalRank || 0,
        }));
    }

    getServerFlightCount(userId, guildId) {
        return this.cache.userServerFlights[userId]?.[guildId] || 0;
    }
}

const globalStatsCache = new GlobalStatsCache();

// Initialize cache after client is ready
client.once("ready", async () => {
    await globalStatsCache.updateCache();
    setInterval(() => globalStatsCache.updateCache(), globalStatsCache.CACHE_TTL);
});

module.exports = globalStatsCache;
