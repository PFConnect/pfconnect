const { EmbedBuilder } = require('discord.js');
const { loadFlightData, saveFlightData, loadGuildData } = require('../functions/api_utils')

module.exports = {
    data: {
        name: 'leaderboard',
        description: 'Displays the top 10 users with the highest points.',
    },
    
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);
        const flightData = await loadFlightData(guildId);

        if (!flightData || !flightData[guildId]?.users) {
            return interaction.reply({ content: 'No leaderboard data available.', ephemeral: true });
        }

        const usersData = flightData[guildId].users;
        const leaderboard = Object.entries(usersData)
        .map(([userId, userData]) => ({
            userId,
            totalPoints: userData.totalPoints || 0
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 10);

        const description = leaderboard.map((entry, index) => {
            const flightText = entry.totalPoints === 1 ? 'Flight' : 'Flights';
            return `**#${index + 1}** <@${entry.userId}> - ${entry.totalPoints} ${flightText}`;
        }).join('\n') || 'No entries found.';

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('Leaderboard')
            .setImage(guildData?.bannerUrl || 'https://pflufthansavirtual.com/Fotos/pfc_banner.png')
            .setDescription(description);

        await interaction.reply({ embeds: [embed] });
    }
};