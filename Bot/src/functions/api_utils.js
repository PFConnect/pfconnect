require("dotenv").config();
// ...

async function loadFlightData(guildId) {
    // Sensible Informations
}

async function saveFlightData(guildId, flightData) {
    // Sensible Informations
}

async function loadGuildData(guildId) {
    // Sensible Informations
}

async function saveGuildData(guildId, newData) {
    // Sensible Informations
}

async function loadShiftData(guildId, userId) {
    // Sensible Informations
}

async function saveShiftData(guildId, userId, newData) {
    // Sensible Informations
}

async function loadShiftServerData(guildId) {
    // Sensible Informations
}

async function deleteShiftData(guildId, shiftId) {
    // Sensible Informations
}

// Test function
(async () => {
    try {
        const guildId = "1308111335950651422";
        const guildData = await loadGuildData(guildId);
        if (guildData) {
            console.log("API connection established");
        } else {
            console.warn("⚠️ Network connection failed: No data received");
        }
    } catch (error) {
        console.error("Network connection error:", error.message);
    }
})();

module.exports = {
    loadFlightData,
    saveFlightData,
    loadGuildData,
    saveGuildData,
    loadShiftData,
    saveShiftData,
    loadShiftServerData,
    deleteShiftData,
};
