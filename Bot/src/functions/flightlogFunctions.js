const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const { loadFlightData, loadGuildData, saveFlightData, saveGuildData } = require("./api_utils");
const { BANNER_GREEN, BANNER_ORANGE, BANNER_RED, UNIVERSAL_ADMIN_IDS } = require("../config");
const config = require("../config");

function generateUniqueFlightId(flightData, guildId) {
    let flightId;
    do {
        flightId = Math.floor(100000 + Math.random() * 900000);
    } while (isFlightIdTaken(flightData[guildId].users, flightId));
    return flightId;
}

function isFlightIdTaken(users, flightId) {
    for (let userId in users) {
        const userFlights = users[userId].flights;
        for (let flight of userFlights) {
            if (flight.flightId === flightId) {
                return true;
            }
        }
    }
    return false;
}

function createFlightEmbed(flight, totalPoints, bannerUrl, userId, reason = null) {
    let embedColor;
    let title = "Flight Logged Successfully!";
    let includeTimestamp = false;

    // Set default banner URLs if they're not valid
    if (!bannerUrl || bannerUrl === "None") {
        bannerUrl = BANNER_GREEN;
    }

    if (bannerUrl === BANNER_ORANGE) {
        embedColor = "#FAC5B0";
        title = "Flight Updated!";
    } else if (bannerUrl === BANNER_RED) {
        embedColor = "#D6A8A3";
        title = "Flight Deleted";
    } else {
        embedColor = "#D9FFD4";
        includeTimestamp = true; // Only include timestamp for new flights (green banner)
    }

    // Base description
    let description = `**Flight ID:** ${flight.flightId}\n\n**User:** <@${userId}>\n\n**Callsign:** ${flight.callsign}\n\n**Aircraft:** ${flight.aircraft}\n\n**Departure:** ${flight.departure}\n\n**Arrival:** ${flight.arrival}\n\n**Cruising Altitude:** ${flight.altitude} ft\n\n**Remark:**\n\`\`\`${flight.remark}\`\`\`\n**Total Flights:** ${totalPoints}\n\n**Screenshot:** [View Screenshot](${flight.screenshotUrl})`;

    // Add reason if provided (for deleted flights)
    if (reason && bannerUrl === BANNER_RED) {
        description += `\n\n**Reason:** ${reason}`;
    }

    const embed = new EmbedBuilder().setColor(embedColor).setTitle(title).setDescription(description);

    // Only set image if bannerUrl is a valid URL
    if (bannerUrl && bannerUrl !== "None" && bannerUrl.startsWith("http")) {
        embed.setImage(bannerUrl);
    }

    // Add timestamp only for new flights (green banner)
    if (includeTimestamp) {
        embed.setTimestamp();
    }

    const denyButton = new ButtonBuilder()
        .setCustomId(`deny_${flight.flightId}`)
        .setLabel("🚫 Delete")
        .setStyle(ButtonStyle.Danger);

    const editButton = new ButtonBuilder()
        .setCustomId(`edit_${flight.flightId}`)
        .setLabel("📋 Edit")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(editButton, denyButton);

    if (bannerUrl === BANNER_RED) {
        row.components.forEach((component) => component.setDisabled(true));
    }

    return { embed, row };
}

async function handleFlightLog(interaction) {
    await interaction.deferReply();
    const callsign = interaction.options.getString("callsign");
    const aircraft = interaction.options.getString("aircraft");
    const departure = interaction.options.getString("departure");
    const arrival = interaction.options.getString("arrival");
    const altitude = interaction.options.getInteger("altitude");
    const remark = interaction.options.getString("remark");
    const screenshot = interaction.options.getAttachment("screenshot");
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    let flightData = await loadFlightData(guildId);

    // Initialize guild structure if it doesn't exist
    if (!flightData[guildId]) {
        flightData[guildId] = { users: {} };
    }

    // Initialize users object if it doesn't exist
    if (!flightData[guildId].users) {
        flightData[guildId].users = {};
    }

    // Initialize user data if it doesn't exist
    if (!flightData[guildId].users[userId]) {
        flightData[guildId].users[userId] = { flights: [], totalPoints: 0 };
    }

    let totalPoints = 1;
    const flightId = generateUniqueFlightId(flightData, guildId);
    const newFlight = {
        flightId,
        callsign,
        aircraft,
        departure,
        arrival,
        altitude,
        remark,
        points: totalPoints,
        screenshotUrl: screenshot.url,
        bannerUrl: BANNER_GREEN,
    };

    flightData[guildId].users[userId].flights.push(newFlight);
    flightData[guildId].users[userId].totalPoints += totalPoints;

    await saveFlightData(guildId, flightData);

    const { embed, row } = createFlightEmbed(
        newFlight,
        flightData[guildId].users[userId].totalPoints,
        BANNER_GREEN,
        userId
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleFlightEditDelete(interaction, flightId, reason) {
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const member = interaction.member;

    try {
        const flightData = await loadFlightData(guildId);
        if (!flightData || !flightData[guildId]) {
            await interaction.reply({ content: "Flight data for this guild is not available.", ephemeral: true });
            return;
        }

        // Find flight owner
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

        if (!flightOwnerId) {
            await interaction.reply({ content: "Flightlog data was not found.", ephemeral: true });
            return;
        }

        const guildData = await loadGuildData(guildId);
        const staffRoles = guildData?.staffRoles || [];
        const memberRoles = member.roles.cache.map((role) => role.id);
        const isStaff = memberRoles.some((role) => staffRoles.includes(role));
        const isCreator = flightOwnerId === userId;
        const isUniversalAdmin = UNIVERSAL_ADMIN_IDS.includes(userId);
        const isOwner = interaction.guild.ownerId === userId;

        if (interaction.isModalSubmit() && reason) {
            // Create a deep copy of the flight before removing it
            const deletedFlight = JSON.parse(JSON.stringify(userFlights[flightIndex]));
            deletedFlight.bannerUrl = BANNER_RED;

            // First update the message with the deleted state
            try {
                const channel = interaction.channel;
                // Fetch more messages to increase chances of finding it
                const messages = await channel.messages.fetch({ limit: 100 });

                // Find the message by checking embeds for flight ID
                let originalMessage = null;
                for (const [_, msg] of messages) {
                    if (msg.embeds && msg.embeds.length > 0) {
                        const embed = msg.embeds[0];
                        if (embed.description && embed.description.includes(`Flight ID: ${flightId}`)) {
                            originalMessage = msg;
                            break;
                        }
                    }
                }

                if (originalMessage) {
                    const { embed, row } = createFlightEmbed(
                        deletedFlight,
                        flightData[guildId].users[flightOwnerId].totalPoints - deletedFlight.points,
                        BANNER_RED,
                        flightOwnerId
                    );
                    await originalMessage.edit({ embeds: [embed], components: [row] });
                } else {
                    console.error(`Could not find original message for flight ID ${flightId}`);
                }
            } catch (err) {
                console.error("Error updating original message:", err);
            }

            // Then actually delete the flight from data
            userFlights.splice(flightIndex, 1);
            flightData[guildId].users[flightOwnerId].totalPoints -= deletedFlight.points;
            await saveFlightData(guildId, flightData);

            await interaction.reply({
                content: `Flight ${flightId} has been deleted. Reason: ${reason}`,
                ephemeral: true,
            });
            return;
        }

        // Handle button interactions
        if (interaction.isButton()) {
            if (interaction.customId === `deny_${flightId}`) {
                if (!isStaff && !isUniversalAdmin && !isOwner) {
                    await interaction.reply({
                        content: "Only staff members or the server owner can delete a flight log.",
                        ephemeral: true,
                    });
                    return;
                }
                await handleFlightDeleteReason(interaction, flightId);
                return;
            }

            if (interaction.customId === `edit_${flightId}`) {
                if (!isStaff && !isCreator && !isUniversalAdmin && !isOwner) {
                    await interaction.reply({
                        content: "Only the creator, staff members, or server owner can edit a flight log.",
                        ephemeral: true,
                    });
                    return;
                }

                const editMenu = new StringSelectMenuBuilder()
                    .setCustomId(`edit_menu_${flightId}_${interaction.message.id}_${interaction.message.channel.id}`)
                    .setPlaceholder("Select a field to edit")
                    .addOptions([
                        { label: "Callsign", value: "callsign" },
                        { label: "Aircraft", value: "aircraft" },
                        { label: "Departure", value: "departure" },
                        { label: "Arrival", value: "arrival" },
                        { label: "Altitude", value: "altitude" },
                        { label: "Remark", value: "remark" },
                    ]);

                const editRow = new ActionRowBuilder().addComponents(editMenu);
                await interaction.reply({
                    content: "Select the field you want to edit:",
                    components: [editRow],
                    ephemeral: true,
                });
                return;
            }
        }

        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            const [, , flightId, originalMessageId, channelId] = interaction.customId.split("_");
            const fieldToEdit = interaction.values[0];
            const flight = userFlights.find((f) => f.flightId === Number(flightId));

            // Update the flight to show it's being edited
            flight.bannerUrl = BANNER_ORANGE;
            await saveFlightData(guildId, flightData);

            // Update the original message with orange banner
            try {
                const channel = interaction.client.channels.cache.get(channelId);
                const originalMessage = await channel.messages.fetch(originalMessageId);

                if (originalMessage) {
                    const { embed, row } = createFlightEmbed(
                        flight,
                        flightData[guildId].users[flightOwnerId].totalPoints,
                        BANNER_ORANGE,
                        flightOwnerId
                    );
                    await originalMessage.edit({ embeds: [embed], components: [row] });
                }
            } catch (err) {
                console.error("Could not update message with orange banner:", err);
            }

            // Create modal for editing
            const modal = new ModalBuilder()
                .setCustomId(`edit_modal_${flightId}_${fieldToEdit}_${originalMessageId}_${channelId}`)
                .setTitle(`Edit ${fieldToEdit.charAt(0).toUpperCase() + fieldToEdit.slice(1)}`);

            const textInput = new TextInputBuilder()
                .setCustomId(fieldToEdit)
                .setLabel(`New ${fieldToEdit}`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue(flight[fieldToEdit] || "");

            const actionRow = new ActionRowBuilder().addComponents(textInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);
            return;
        }

        // Handle modal submission for edits
        if (interaction.isModalSubmit() && interaction.customId.startsWith("edit_modal")) {
            const [, , flightId, fieldToEdit, originalMessageId, channelId] = interaction.customId.split("_");
            const newValue = interaction.fields.getTextInputValue(fieldToEdit);

            // Update the flight data
            const flight = userFlights.find((f) => f.flightId === Number(flightId));
            if (flight) {
                flight[fieldToEdit] = newValue;
                flight.bannerUrl = BANNER_ORANGE;
                await saveFlightData(guildId, flightData);

                // Update the original message
                try {
                    const channel = interaction.client.channels.cache.get(channelId);
                    const originalMessage = await channel.messages.fetch(originalMessageId);

                    if (originalMessage) {
                        const { embed, row } = createFlightEmbed(
                            flight,
                            flightData[guildId].users[flightOwnerId].totalPoints,
                            BANNER_ORANGE,
                            flightOwnerId
                        );
                        await originalMessage.edit({ embeds: [embed], components: [row] });
                    }

                    await interaction.reply({
                        content: `Successfully updated ${fieldToEdit}!`,
                        ephemeral: true,
                    });
                } catch (err) {
                    console.error("Error updating flight message:", err);
                    await interaction.reply({
                        content: "Flight was updated but there was an error updating the message.",
                        ephemeral: true,
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error in handleFlightEditDelete:", error);
        if (!interaction.replied) {
            await interaction.reply({
                content: "An error occurred while processing your request.",
                ephemeral: true,
            });
        }
    }
}

async function handleFlightDeleteReason(interaction, flightId) {
    try {
        const modal = new ModalBuilder().setCustomId(`delete_reason_${flightId}`).setTitle("Reason for Deletion");

        const reasonInput = new TextInputBuilder()
            .setCustomId("reason_input")
            .setLabel("Reason")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("Enter the reason for deletion...")
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    } catch (error) {
        console.error("Error showing modal:", error);
        await interaction.reply({
            content: "An error occurred while showing the deletion reason modal.",
            ephemeral: true,
        });
    }
}

module.exports = { handleFlightLog, handleFlightEditDelete, createFlightEmbed };
