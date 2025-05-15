const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'uptime',
        description: 'Shows how long the bot has been running.'
    },

    async execute(interaction) {
        const uptime = process.uptime();

        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const uptimeString =
            `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('🕒 Bot Uptime')
            .setDescription(`The bot has been running for\n### ${uptimeString}`);

        await interaction.reply({ embeds: [embed] });
    }
};
