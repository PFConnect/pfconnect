const fs = require("fs");
const path = require("path");

const ticketChannelsPath = path.join(__dirname, "../resources/ticketChannels.json");

function loadTicketChannels() {
    if (!fs.existsSync(ticketChannelsPath)) {
        const initialData = { guilds: {} };
        fs.writeFileSync(ticketChannelsPath, JSON.stringify(initialData, null, 2));
        return initialData;
    }

    const data = JSON.parse(fs.readFileSync(ticketChannelsPath, "utf8"));

    if (!data.guilds) {
        data.guilds = {};
    }

    return data;
}

function saveTicketChannels(data) {
    fs.writeFileSync(ticketChannelsPath, JSON.stringify(data, null, 2));
}

function addTicketChannel(guildId, channelId) {
    const data = loadTicketChannels();

    if (!data.guilds[guildId]) {
        data.guilds[guildId] = [];
    }

    data.guilds[guildId].push(channelId);
    saveTicketChannels(data);
}

function removeTicketChannel(guildId, channelId) {
    const data = loadTicketChannels();

    if (data.guilds[guildId]) {
        data.guilds[guildId] = data.guilds[guildId].filter((id) => id !== channelId);
        saveTicketChannels(data);
    }
}

function isTicketChannel(guildId, channelId) {
    const data = loadTicketChannels();
    return data.guilds[guildId]?.includes(channelId) || false;
}

module.exports = { loadTicketChannels, saveTicketChannels, addTicketChannel, removeTicketChannel, isTicketChannel };
