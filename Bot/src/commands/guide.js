const { EmbedBuilder } = require('discord.js');
const { loadGuildData } = require('../functions/api_utils');

module.exports = {
    data: {
        name: 'guide',
        description: "Don't know how to get started? This might help you."
    },

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);
        const guildOwner = await interaction.guild.fetchOwner();

        const embed = new EmbedBuilder()
            .setColor(guildData?.guideColor || "#000000")
            .setTitle(guildData?.guideTitle || " ")
            .setDescription(guildData?.guideDescription || `# Not set up yet!\nTalk with the Server Owner: <@${guildOwner.id}>`)
            .setFooter({ text: guildData?.guideFooter || " "})
        .setImage(guildData?.bannerUrl || 'https://pflufthansavirtual.com/Fotos/pfc_banner.png');

        await interaction.reply({ embeds: [embed] });
    }
};