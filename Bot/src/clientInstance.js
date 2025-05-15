const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
    intents: [
        // Sensible Informations
    ],

    // ...
});

module.exports = client;
