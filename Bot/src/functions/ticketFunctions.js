const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const { loadGuildData, saveGuildData } = require("./api_utils");
const { addTicketChannel, removeTicketChannel, isTicketChannel } = require("./ticketChannels.js");
const { createTranscript } = require("discord-html-transcripts");
const { uploadTranscriptToServer } = require("../utils/transcriptUtils.js");

// Rate limiting for ticket creation
const ticketCooldowns = new Map();

async function createTicket(interaction, category) {
    // Sensible Informations
}

async function closeTicket(interaction, isDeferred = false, isSlashCommand = true) {
    // Sensible Informations
}

async function addUserToTicket(interaction, user) {
    // Sensible Informations
}

async function removeUserFromTicket(interaction, user) {
    // Sensible Informations
}

module.exports = { createTicket, closeTicket, addUserToTicket, removeUserFromTicket };
