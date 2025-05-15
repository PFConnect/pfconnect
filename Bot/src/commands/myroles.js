const { EmbedBuilder } = require('discord.js');
const { loadGuildData } = require('../functions/api_utils')

module.exports = {
    data: {
        name: 'myroles',
        description: 'Shows the roles of a specific user.',
        options: [
            {
                name: 'user',
                type: 6,
                description: 'The user to get the roles of.',
                required: false
            }
        ]
    },

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);

        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);

        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => `<@&${role.id}>`)
            .join('\n') || 'No roles assigned.';

            const embed = new EmbedBuilder()
            .setColor("#000000")
            .setTitle(" ")
            .setDescription(`## Roles for <@${user.id}> \n${roles}`)
            .setImage(guildData?.bannerUrl || 'https://pflufthansavirtual.com/Fotos/pfc_banner.png');

        await interaction.reply({ embeds: [embed] });
    }
};
