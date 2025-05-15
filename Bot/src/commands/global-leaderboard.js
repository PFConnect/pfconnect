const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { loadFlightData } = require("../functions/api_utils");
const { BANNER } = require("../config");

const leaderboardCache = {
    data: null,
    timestamp: 0,
    totalPages: 0,
};

const CACHE_TTL = 5 * 60 * 1000;

module.exports = {
    data: {
        name: "global-leaderboard",
        description: "Display the top servers with the most flights.",
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildsPerPage = 5;

            const now = Date.now();
            if (!leaderboardCache.data || now - leaderboardCache.timestamp > CACHE_TTL) {
                const guilds = interaction.client.guilds.cache;
                const guildFlightData = [];

                const results = await Promise.allSettled(
                    Array.from(guilds).map(async ([guildId, guild]) => {
                        try {
                            const flightData = await loadFlightData(guildId);

                            if (flightData && flightData[guildId] && flightData[guildId].users) {
                                const users = flightData[guildId].users;
                                const totalPoints = Object.values(users).reduce(
                                    (sum, user) => sum + (user.totalPoints || 0),
                                    0
                                );

                                return {
                                    name: guild.name,
                                    totalPoints: totalPoints,
                                    id: guildId,
                                    icon: guild.iconURL({ dynamic: true }),
                                };
                            }
                            return null;
                        } catch (error) {
                            console.error(`Error loading data for guild ${guildId}:`, error);
                            return null;
                        }
                    })
                );

                for (const result of results) {
                    if (result.status === "fulfilled" && result.value) {
                        guildFlightData.push(result.value);
                    }
                }

                guildFlightData.sort((a, b) => b.totalPoints - a.totalPoints);

                leaderboardCache.data = guildFlightData;
                leaderboardCache.timestamp = now;
                leaderboardCache.totalPages = Math.ceil(guildFlightData.length / guildsPerPage);
            }

            const guildFlightData = leaderboardCache.data;
            const totalPages = leaderboardCache.totalPages;

            const generateEmbed = (page) => {
                const start = (page - 1) * guildsPerPage;
                const end = Math.min(start + guildsPerPage, guildFlightData.length);

                const leaderboardDescription =
                    guildFlightData.length > 0
                        ? guildFlightData
                              .slice(start, end)
                              .map((guild, index) => {
                                  return `**#${start + index + 1}** - **${guild.name}**\n> Total Flights: **${
                                      guild.totalPoints
                                  }**`;
                              })
                              .join("\n\n")
                        : "No flight data available from any servers.";

                return new EmbedBuilder()
                    .setColor("#000000")
                    .setTitle("<:earth:1349757706705305601> Global Leaderboard")
                    .setDescription(leaderboardDescription)
                    .setFooter({
                        text: `Page ${page}/${totalPages} • Requested by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL(),
                    })
                    .setImage(BANNER);
            };

            const generateButtons = (currentPage) => {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_first_${interaction.user.id}`)
                        .setLabel("First")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage <= 1),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_prev_${interaction.user.id}`)
                        .setLabel("Previous")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage <= 1),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_next_${interaction.user.id}`)
                        .setLabel("Next")
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage >= totalPages),
                    new ButtonBuilder()
                        .setCustomId(`leaderboard_last_${interaction.user.id}`)
                        .setLabel("Last")
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(currentPage >= totalPages)
                );

                return row;
            };

            let currentPage = 1;
            const embed = generateEmbed(currentPage);
            const buttons = generateButtons(currentPage);

            await interaction.editReply({
                embeds: [embed],
                components: [buttons],
            });
        } catch (error) {
            console.error("Error in global leaderboard command:", error);
            await interaction.followUp({
                content: "There was an error fetching the global leaderboard.",
                ephemeral: true,
            });
        }
    },

    async handleButton(interaction) {
        const [_, action, userId] = interaction.customId.split("_");

        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: "These buttons are not for you.",
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();

        const embed = interaction.message.embeds[0];
        const footer = embed.footer.text;
        const currentPage = parseInt(footer.split("/")[0].replace("Page ", ""));
        const totalPages = parseInt(footer.split("/")[1]);

        let newPage = currentPage;
        switch (action) {
            case "first":
                newPage = 1;
                break;
            case "prev":
                newPage = Math.max(1, currentPage - 1);
                break;
            case "next":
                newPage = Math.min(totalPages, currentPage + 1);
                break;
            case "last":
                newPage = totalPages;
                break;
        }

        if (newPage === currentPage) return;

        if (!leaderboardCache.data) {
            return interaction.editReply({
                content: "Leaderboard data expired. Please run the /global-leaderboard command again.",
                embeds: [],
                components: [],
            });
        }

        const guildFlightData = leaderboardCache.data;
        const guildsPerPage = 5;

        const start = (newPage - 1) * guildsPerPage;
        const end = Math.min(start + guildsPerPage, guildFlightData.length);

        const leaderboardDescription =
            guildFlightData.length > 0
                ? guildFlightData
                      .slice(start, end)
                      .map((guild, index) => {
                          return `**#${start + index + 1}** - **${guild.name}**\n> Total Flights: **${
                              guild.totalPoints
                          }**`;
                      })
                      .join("\n\n")
                : "No flight data available from any servers.";

        const newEmbed = new EmbedBuilder()
            .setColor("#000000")
            .setTitle("<:earth:1349757706705305601> Global Leaderboard")
            .setDescription(leaderboardDescription)
            .setFooter({
                text: `Page ${newPage}/${totalPages} • Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setImage(BANNER);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`leaderboard_first_${interaction.user.id}`)
                .setLabel("First")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(newPage <= 1),
            new ButtonBuilder()
                .setCustomId(`leaderboard_prev_${interaction.user.id}`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(newPage <= 1),
            new ButtonBuilder()
                .setCustomId(`leaderboard_next_${interaction.user.id}`)
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(newPage >= totalPages),
            new ButtonBuilder()
                .setCustomId(`leaderboard_last_${interaction.user.id}`)
                .setLabel("Last")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(newPage >= totalPages)
        );

        await interaction.editReply({
            embeds: [newEmbed],
            components: [buttons],
        });
    },
};
