const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ICON, BANNER } = require("../config");

// Global cache for server data
const serverCache = {
    data: null,
    timestamp: 0,
    totalPages: 0,
};

// Cache valid for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

module.exports = {
    data: {
        name: "servers",
        description: "See all Airlines with the PFConnect Bot.",
    },

    async execute(interaction) {
        await interaction.deferReply();

        const serversPerPage = 10;
        const client = interaction.client;

        // Function to fetch all server data
        const fetchServersData = async () => {
            const guilds = client.guilds.cache;

            // Gather basic info without additional API calls when possible
            const serversDetails = guilds.map((guild) => ({
                name: guild.name,
                id: guild.id,
                memberCount: guild.memberCount,
                icon: guild.iconURL({ dynamic: true }),
            }));

            // Sort servers by member count (highest first)
            serversDetails.sort((a, b) => b.memberCount - a.memberCount);

            return {
                servers: serversDetails,
                totalPages: Math.ceil(serversDetails.length / serversPerPage),
            };
        };

        // Check if we need to refresh the cache
        const now = Date.now();
        if (!serverCache.data || now - serverCache.timestamp > CACHE_TTL) {
            const { servers, totalPages } = await fetchServersData();

            // Update cache
            serverCache.data = servers;
            serverCache.timestamp = now;
            serverCache.totalPages = totalPages;
        }

        const serversDetails = serverCache.data;
        const totalPages = serverCache.totalPages;

        // Function to generate embed for a specific page
        const generateEmbed = (page) => {
            const start = (page - 1) * serversPerPage;
            const end = Math.min(start + serversPerPage, serversDetails.length);

            const serversDisplay = serversDetails
                .slice(start, end)
                .map((guild, index) => `> ${start + index + 1}. **${guild.name}** • ${guild.memberCount} members`)
                .join("\n");

            return new EmbedBuilder()
                .setAuthor({ name: "PFConnect", iconURL: ICON })
                .setColor("#000000")
                .setTitle(`Servers with the PFConnect Bot (${serversDetails.length} total)`)
                .setDescription(serversDisplay)
                .setFooter({ text: `Page ${page}/${totalPages}` })
                .setImage(BANNER);
        };

        // Function to generate pagination buttons
        const generateButtons = (currentPage) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`servers_first_${interaction.user.id}`)
                    .setLabel("First")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPage <= 1),
                new ButtonBuilder()
                    .setCustomId(`servers_prev_${interaction.user.id}`)
                    .setLabel("Previous")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage <= 1),
                new ButtonBuilder()
                    .setCustomId(`servers_next_${interaction.user.id}`)
                    .setLabel("Next")
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage >= totalPages),
                new ButtonBuilder()
                    .setCustomId(`servers_last_${interaction.user.id}`)
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
    },

    // Method to handle button interactions for this command
    async handleButton(interaction) {
        // Extract the action and check user ID to prevent others from using these buttons
        const [_, action, userId] = interaction.customId.split("_");

        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: "These buttons are not for you.",
                ephemeral: true,
            });
        }

        await interaction.deferUpdate();

        // Get current page from footer
        const embed = interaction.message.embeds[0];
        const footer = embed.footer.text;
        const currentPage = parseInt(footer.split("/")[0].replace("Page ", ""));
        const totalPages = parseInt(footer.split("/")[1]);

        // Calculate the new page based on the button clicked
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

        // Use the cached server data instead of re-fetching
        if (!serverCache.data) {
            // If cache is missing somehow, notify user
            return interaction.editReply({
                content: "Server data expired. Please run the /servers command again.",
                embeds: [],
                components: [],
            });
        }

        const serversDetails = serverCache.data;
        const serversPerPage = 10;

        // Generate new embed and buttons
        const start = (newPage - 1) * serversPerPage;
        const end = Math.min(start + serversPerPage, serversDetails.length);

        const serversDisplay = serversDetails
            .slice(start, end)
            .map((guild, index) => `> ${start + index + 1}. **${guild.name}** • ${guild.memberCount} members`)
            .join("\n");

        const newEmbed = new EmbedBuilder()
            .setAuthor({ name: "PFConnect", iconURL: ICON })
            .setColor("#000000")
            .setTitle(`Servers with the PFConnect Bot (${serversDetails.length} total)`)
            .setDescription(serversDisplay)
            .setFooter({ text: `Page ${newPage}/${totalPages}` })
            .setImage(BANNER);

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`servers_first_${interaction.user.id}`)
                .setLabel("First")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(newPage <= 1),
            new ButtonBuilder()
                .setCustomId(`servers_prev_${interaction.user.id}`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(newPage <= 1),
            new ButtonBuilder()
                .setCustomId(`servers_next_${interaction.user.id}`)
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(newPage >= totalPages),
            new ButtonBuilder()
                .setCustomId(`servers_last_${interaction.user.id}`)
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
