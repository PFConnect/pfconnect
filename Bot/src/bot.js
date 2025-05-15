require("dotenv").config();
const path = require("path");
const fs = require("fs");

// ----------------------------------------
// UTILS

const { createBackup } = require("./utils/createBackup");
const { updateAirlinesData } = require("./utils/updateAirlinesData");
const { assignRoles } = require("./utils/assignRoles");
const screenshotManager = require("./utils/screenshotManager");

// ----------------------------------------
// CLIENT

const { TOKEN, CLIENT_ID, GUILD_ID, BANNER, BANNER_RED, BANNER_ORANGE, BANNER_GREEN } = require("./config");
const {
    REST,
    Routes,
    ActivityType,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} = require("discord.js");

const rest = new REST({ version: "10" }).setToken(TOKEN);
const client = require("./clientInstance");

const commands = [];
const commandFiles = fs.readdirSync(path.join(__dirname, "commands")).filter((file) => file.endsWith(".js"));
const commandHandlers = new Map();

for (const file of commandFiles) {
    try {
        const command = require(`./commands/${file}`);
        if (!command.data || !command.data.name) {
            console.error(`Command file ${file} is missing a valid 'data' or 'data.name' property.`);
            continue;
        }
        commands.push(command.data);
        commandHandlers.set(command.data.name, command.execute);
    } catch (error) {
        console.log(error, `loading command file ${file}`);
    }
}

// ----------------------------------------

(async () => {
    try {
        console.log("Registering commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("Commands registered successfully!");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
})();

// ----------------------------------------

let serverDetailsCache = [];
let lastServerDetailsUpdate = 0;

async function getServersDetails() {
    return serverDetailsCache;
}

async function updateServerDetailsCache() {
    const servers = [];

    for (const guild of client.guilds.cache.values()) {
        try {
            const serverInfo = {
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL({ dynamic: true, size: 256 }),
                memberCount: guild.memberCount,
                owner: {
                    id: guild.ownerId,
                    username: (await guild.fetchOwner()).user.username,
                },
                createdAt: guild.createdAt,
                joinedAt: guild.joinedAt,
                premiumTier: guild.premiumTier,
                premiumSubscriptionCount: guild.premiumSubscriptionCount,
                features: guild.features,
            };

            servers.push(serverInfo);
        } catch (error) {
            console.error(`Error fetching details for server ${guild.id}:`, error);
        }
    }

    serverDetailsCache = servers;
    lastServerDetailsUpdate = Date.now();
    console.log(`Server details cache updated at ${new Date().toISOString()}`);
}

setInterval(updateServerDetailsCache, 60 * 60 * 1000);

// ----------------------------------------

client.once("ready", async () => {
    console.log(`Online as ${client.user.tag}`);
    client.user.setPresence({
        activities: [{ name: "PFConnect", type: ActivityType.Watching }],
        status: "online",
    });

    await updateAirlinesData().catch(console.error);
    await assignRoles().catch(console.error);

    setInterval(() => {
        updateAirlinesData().catch(console.error);
    }, 60 * 60 * 1000);

    setInterval(() => {
        assignRoles().catch(console.error);
    }, 15 * 60 * 1000);

    /*
    // Creates too heavy/big files and is not really necessary
    setInterval(() => {
        createBackup().catch(console.error);
    }, 24 * 60 * 60 * 1000);
    */
});

// ----------------------------------------
// INTERACTIONS (Slash Commands)

const { createTicket, closeTicket } = require("./functions/ticketFunctions");
const { createFlightEmbed } = require("./functions/flightlogFunctions");
const { loadFlightData, loadGuildData, saveFlightData } = require("./functions/api_utils");
const { handleFlightEditDelete } = require("./functions/flightlogFunctions");
const { handleChartSelection } = require("./commands/pfcharts");
const metarCommand = require("./commands/metar");
const closeRequestCommand = require("./commands/closerequest");
const serversCommand = require("./commands/servers");
const globalLeaderboardCommand = require("./commands/global-leaderboard");
const {
    handleMyShiftsButton,
    handleRefreshLeaderboardButton,
    handleBackToLeaderboardButton,
    handleRefreshMyStatsButton,
    handleRefreshActiveShiftsButton,
    handleRefreshGlobalLeaderboardButton,
} = require("./functions/shiftFunctions");
const { error } = require("console");

client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isCommand()) {
            if (!interaction.guild) {
                await interaction.reply({
                    content: "This Bot doesn't support DM commands. Please join a Server to use this command.",
                    ephemeral: true,
                });
                return;
            }

            const command = commandHandlers.get(interaction.commandName);
            if (command) {
                await command(interaction);
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith("decode_metar_")) {
                await metarCommand.handleButton(interaction);
            }
            if (interaction.customId === "close_ticket") {
                await closeTicket(interaction);
            }
            if (
                interaction.customId.startsWith("accept_close_") ||
                interaction.customId.startsWith("deny_keep_open_")
            ) {
                await closeRequestCommand.handleButton(interaction);
            }
            if (interaction.customId.startsWith("deny_") || interaction.customId.startsWith("edit_")) {
                const flightId = interaction.customId.split("_")[1];
                await handleFlightEditDelete(interaction, flightId);
            }
            if (interaction.customId.startsWith("servers_")) {
                await serversCommand.handleButton(interaction);
                return;
            }
            if (interaction.customId.startsWith("leaderboard_")) {
                await globalLeaderboardCommand.handleButton(interaction);
                return;
            }
            if (interaction.customId.startsWith("pilots_")) {
                const pilotsCommand = require("./commands/pilots");
                await pilotsCommand.handleButton(interaction);
                return;
            }
            if (interaction.customId.startsWith("serverstats_refresh_")) {
                const serverstatsCommand = require("./commands/serverstats");
                await serverstatsCommand.handleButton(interaction);
                return;
            }

            // Shift Buttons
            if (interaction.customId === "my_shifts") {
                await handleMyShiftsButton(interaction);
            } else if (interaction.customId === "refresh_leaderboard") {
                await handleRefreshLeaderboardButton(interaction);
            } else if (interaction.customId === "back_to_leaderboard") {
                await handleBackToLeaderboardButton(interaction);
            } else if (interaction.customId === "refresh_my_stats") {
                await handleRefreshMyStatsButton(interaction);
            } else if (interaction.customId === "shifts_active") {
                await handleRefreshActiveShiftsButton(interaction);
            } else if (interaction.customId === "shifts_global") {
                await handleRefreshGlobalLeaderboardButton(interaction);
            } else {
                console.warn(`No handler for button ${interaction.customId}`);
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "ticket_category") {
                try {
                    await interaction.deferReply({ ephemeral: true });

                    const category = interaction.values[0];
                    const result = await createTicket(interaction, category);

                    if (!interaction.replied) {
                        await interaction.editReply({
                            content: result.message,
                            ephemeral: true,
                        });
                    }

                    await interaction.message.edit({
                        components: interaction.message.components,
                    });
                } catch (error) {
                    console.error("Error handling ticket creation:", error);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: "There was an error while creating the ticket. Please try again later.",
                            ephemeral: true,
                        });
                    } else {
                        await interaction.editReply({
                            content: "There was an error while creating the ticket. Please try again later.",
                            ephemeral: true,
                        });
                    }
                }
            }
            if (interaction.customId.startsWith("edit_menu_")) {
                try {
                    const flightId = interaction.customId.split("_")[2];
                    const editField = interaction.values[0];
                    const messageId = interaction.customId.split("_")[3];
                    const channelId = interaction.customId.split("_")[4];
                    let style;
                    const modal = new ModalBuilder()
                        .setCustomId(`edit_modal_${editField}_${flightId}_${messageId}_${channelId}`)
                        .setTitle("Edit Menu");

                    if (interaction.values[0] === "route") {
                        style = TextInputStyle.Paragraph;
                    } else {
                        style = TextInputStyle.Short;
                    }

                    const input = new TextInputBuilder()
                        .setCustomId(`value`)
                        .setLabel(editField)
                        .setStyle(style)
                        .setRequired(true);

                    const inputRow = new ActionRowBuilder().addComponents(input);
                    modal.addComponents(inputRow);

                    await interaction.showModal(modal);
                } catch (error) {
                    await console.log(error, "edit menu interaction", interaction);
                }
            }
            if (interaction.customId === "chart-select") {
                await handleChartSelection(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            const customIdsplit = interaction.customId.split("_");

            if (interaction.customId.startsWith("delete_reason_")) {
                try {
                    const flightId = interaction.customId.split("_")[2];
                    const reason = interaction.fields.getTextInputValue("reason_input");

                    // Defer first to prevent interaction timeout
                    await interaction.deferReply({ ephemeral: true });

                    const guildId = interaction.guild.id;
                    const flightData = await loadFlightData(guildId);

                    // Find the flight owner
                    let flightOwnerId = null;
                    let flightIndex = -1;
                    let userFlights = null;

                    for (const [id, userData] of Object.entries(flightData[guildId].users || {})) {
                        const index = userData.flights.findIndex((f) => f.flightId === Number(flightId));
                        if (index !== -1) {
                            flightOwnerId = id;
                            flightIndex = index;
                            userFlights = userData.flights;
                            break;
                        }
                    }

                    if (flightOwnerId && flightIndex !== -1) {
                        // Create a deep copy of the flight before removing it
                        const deletedFlight = JSON.parse(JSON.stringify(userFlights[flightIndex]));
                        deletedFlight.bannerUrl = BANNER_RED;

                        try {
                            // Try to find the original message in the interaction channel first
                            let originalMessage = null;

                            // Option 1: Check if the interaction came from a message component
                            if (interaction.message) {
                                originalMessage = interaction.message;
                            }

                            // Option 2: Search in the channel if option 1 fails
                            if (!originalMessage) {
                                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                                for (const [_, msg] of messages) {
                                    if (msg.embeds.length > 0) {
                                        const embed = msg.embeds[0];
                                        if (embed.description && embed.description.includes(`Flight ID: ${flightId}`)) {
                                            originalMessage = msg;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (originalMessage) {
                                const { embed, row } = createFlightEmbed(
                                    deletedFlight,
                                    flightData[guildId].users[flightOwnerId].totalPoints - deletedFlight.points,
                                    BANNER_RED,
                                    flightOwnerId,
                                    reason
                                );
                                await originalMessage.edit({ embeds: [embed], components: [row] });
                            } else {
                                console.error(`Could not find original message for flight ID ${flightId}`);
                            }
                        } catch (err) {
                            console.error("Error updating original message:", err);
                        }

                        // Remove the flight from the data
                        userFlights.splice(flightIndex, 1);
                        flightData[guildId].users[flightOwnerId].totalPoints -= deletedFlight.points || 1;
                        await saveFlightData(guildId, flightData);

                        await interaction.editReply({
                            content: `Flight ${flightId} has been deleted. Reason: ${reason}`,
                            flags: MessageFlags.Ephemeral, // Updated to use flags instead of ephemeral property
                        });
                    } else {
                        await interaction.editReply({
                            content: "Flight not found.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }
                } catch (error) {
                    console.error("Error handling delete modal:", error);
                    await interaction.editReply({
                        content: "An error occurred while processing your request.",
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }

            if (customIdsplit[0] === "edit" && customIdsplit[1] === "modal") {
                try {
                    await interaction.deferReply({ ephemeral: true });
                    const value = interaction.fields.getTextInputValue("value");
                    const editField = customIdsplit[2];
                    const flightId = customIdsplit[3];
                    const messageId = customIdsplit[4];
                    const channelId = customIdsplit[5];
                    const guild = interaction.guild;
                    const channel = await guild.channels.fetch(channelId);
                    const editedMessage = await channel.messages.fetch(messageId);
                    const flightData = await loadFlightData(interaction.guild.id);

                    // Find the flight owner
                    let flightOwnerId = null;
                    for (const [userId, userData] of Object.entries(flightData[interaction.guild.id].users || {})) {
                        const flight = userData.flights.find((f) => f.flightId === Number(flightId));
                        if (flight) {
                            flightOwnerId = userId;
                            break;
                        }
                    }

                    if (!flightOwnerId) {
                        await interaction.editReply({ content: "Flight not found.", ephemeral: true });
                        return;
                    }

                    const userFlights = flightData[interaction.guild.id].users[flightOwnerId].flights;
                    const flightToEdit = userFlights.find((f) => f.flightId === Number(flightId));

                    if (!flightToEdit) {
                        await interaction.editReply({ content: "Flight not found.", ephemeral: true });
                        return;
                    }

                    switch (editField) {
                        case "callsign": {
                            flightToEdit.callsign = value;
                            break;
                        }
                        case "aircraft": {
                            flightToEdit.aircraft = value;
                            break;
                        }
                        case "departure": {
                            flightToEdit.departure = value;
                            break;
                        }
                        case "arrival": {
                            flightToEdit.arrival = value;
                            break;
                        }
                        case "altitude": {
                            flightToEdit.altitude = value;
                            break;
                        }
                        case "route": {
                            flightToEdit.route = value;
                            break;
                        }
                        default: {
                            break;
                        }
                    }

                    // Important: Set the banner to ORANGE for edits
                    flightToEdit.bannerUrl = BANNER_ORANGE;

                    await saveFlightData(interaction.guild.id, flightData);

                    const { embed, row } = createFlightEmbed(
                        flightToEdit,
                        flightData[interaction.guild.id].users[flightOwnerId].totalPoints,
                        BANNER_ORANGE, // Use BANNER_ORANGE for edits
                        flightOwnerId
                    );

                    await editedMessage.edit({ embeds: [embed], components: [row] });
                    await interaction.editReply({ content: "Successfully edited your flight", ephemeral: true });
                } catch (error) {
                    console.error(error, "edit modal submit", interaction);
                    await interaction.editReply({
                        content: "An error occurred while editing your flight",
                        ephemeral: true,
                    });
                }
            }
        }
    } catch (error) {
        if (error.code === 10062) {
            console.warn("Ignored DiscordAPIError[10062]: Unknown interaction");
            return;
        }

        if (error.code === 40060) {
            console.warn("Ignored DiscordAPIError[40060]: Interaction has already been acknowledged");
            return;
        }

        if (error.code === 50001) {
            console.warn(`Missing Access in guild ${interaction.guild?.name} (${interaction.guild?.id})`);
            return;
        }

        console.error(error, "interactionCreate", interaction);
    }
});

// ----------------------------------------
client.on("messageReactionAdd", async (reactionRole, user) => {
    try {
        if (user.bot) return;

        if (reactionRole.message.partial) await reactionRole.message.fetch();
        const map = client.reactionRoleMap.get(reactionRole.message.id);
        if (!map) return;
        const roleId = map[reactionRole.emoji.toString()];
        if (roleId) {
            const member = await reactionRole.message.guild.members.fetch(user.id);
            await member.roles.add(roleId);
        }
    } catch (error) {
        console.log(error);
    }
});

client.on("messageReactionRemove", async (reaction, user) => {
    try {
        if (user.bot) return;

        if (reaction.partial) await reaction.fetch();
        const map = client.reactionRoleMap.get(reaction.message.id);
        if (!map) return;
        const roleId = map[reaction.emoji.toString()];
        if (roleId) {
            const member = await reaction.message.guild.members.fetch(user.id);
            await member.roles.remove(roleId);
        }
    } catch (error) {
        console.log(error);
    }
});
//-----------------------------------------
function getOrdinalSuffix(number) {
    const suffixes = ["th", "st", "nd", "rd"];
    const remainder = number % 100;
    return number + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
}

const recentlyWelcomed = new Set();

client.on("guildMemberAdd", async (member) => {
    if (recentlyWelcomed.has(member.id)) return;

    recentlyWelcomed.add(member.id);
    setTimeout(() => recentlyWelcomed.delete(member.id), 5000); // Clear after 5 seconds

    const guild = member.guild;
    const guildId = guild.id;
    const guildName = guild.name;
    const guildData = await loadGuildData(guildId);

    if (!guildData) {
        console.log(`Guild data for ${guildId} does not exist.`);
        return;
    }

    // Check if welcome messages are disabled
    if (guildData.welcomeEnabled === false) {
        return;
    }

    const bannerURL = guildData?.bannerUrl || "https://pflufthansavirtual.com/Fotos/pfc_banner.png";
    const welcomeChannelId = guildData?.welcomeChannel;
    const channel = guild.channels.cache.get(welcomeChannelId);

    if (!welcomeChannelId || !channel) {
        console.log(`Welcome channel not found for Guild: ${guildName}`);
        return;
    }

    const serverIconURL = guild.iconURL({ dynamic: true, size: 256 });
    const memberCount = guild.memberCount;
    const memberCountOrdinal = getOrdinalSuffix(memberCount);

    const owner = await guild.fetchOwner();

    const processText = (text) => {
        if (!text) return text;
        return text
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{server}/g, guild.name)
            .replace(/{channel}/g, `#${channel.name}`)
            .replace(/{owner}/g, `<@${owner.id}>`)
            .replace(/{membercount\.ordinal}/g, `${memberCountOrdinal}`)
            .replace(/{membercount}/g, `${memberCount}`);
    };

    const embed = new EmbedBuilder()
        .setAuthor({
            name: guild.name,
            iconURL: serverIconURL,
        })
        .setTitle(processText(guildData.welcomeTitle) || `Welcome to ${guild.name}`)
        .setDescription(
            processText(guildData.welcomeDescription) ||
                `Thank you for choosing ${guild.name}! You are our **${memberCountOrdinal}** member.`
        )
        .setImage(bannerURL)
        .setFooter({ text: processText(guildData.welcomeFooter) || `Thank you for choosing ${guild.name}` });

    if (guildData.welcomeColor) {
        embed.setColor(guildData.welcomeColor);
    }

    const welcomeContent = processText(guildData.welcomeMessage) || `🎉 Welcome, <@${member.id}>!`;
    try {
        await channel.send({ content: welcomeContent, embeds: [embed] });
    } catch (error) {
        if (error.code === 50001) {
            console.warn(`Missing Access to send welcome message in ${guild.name} (${guild.id})`);
            return;
        }
        console.error(`Error sending welcome message in ${guild.name}:`, error);
    }
});

client.on("guildCreate", async (guild) => {
    try {
        const owner = await guild.fetchOwner();

        const embed = new EmbedBuilder()
            .setColor("#000000")
            .setTitle("Thank you for adding PFConnect!")
            .setDescription(
                "Since you have added the PFConnect Bot to your server, you can now set it up using our Web Dashboard: **https://pfconnect.online**.\nIf you need help or want to see a list of commands, use `/help` in any channel.\nOur latest Update also features **Shift Logging**!!\n\nPlease notify your members that (if they use the Bot) *have* to read our:\n- Terms of Use: https://terms.pfconnect.online\n- Privacy Policy: https://privacy.pfconnect.online\n\nIf you have any questions, feel free to reach out to us in the support server: https://discord.gg/tNURxzY2tP"
            )
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .setTimestamp()
            .setFooter({ text: "PFConnect Bot" });

        await owner.send({ embeds: [embed] });
    } catch (error) {
        if (error.code === 50007) {
            console.log(`Cannot send DM to the owner of ${guild.name}. DMs might be disabled.`);
        } else {
            console.error("Error in HelloDM: ", error);
        }
    }
});

async function getServers() {
    let serverCount = client.guilds.cache.size;
    return serverCount;
}

const getUniqueMemberCount = async () => {
    const uniqueMemberIds = new Set();

    for (const [guildId, guild] of client.guilds.cache) {
        try {
            const fullGuild = await guild.fetch();
            const members = await fullGuild.members.fetch();

            members.forEach((member) => {
                uniqueMemberIds.add(member.user.id);
            });
        } catch (err) {
            console.error(`Error fetching members for guild ${guild.name}:`, err);
        }
    }

    return uniqueMemberIds.size;
};

module.exports.getUniqueMemberCount = getUniqueMemberCount;
