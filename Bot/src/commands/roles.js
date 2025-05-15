const { EmbedBuilder } = require('discord.js');
const { loadGuildData } = require('../functions/api_utils');

module.exports = {
    data: {
        name: 'roles',
        description: 'Shows all roles in the server.'
    },

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);

        const roles = interaction.guild.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => `<@&${role.id}>`)
            .join('\n') || 'No roles available.';

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('Server Roles')
            .setDescription(roles)
            .setImage(guildData?.bannerUrl || 'https://pflufthansavirtual.com/Fotos/pfc_banner.png');

        await interaction.reply({ embeds: [embed] });
    }
};
