const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'setup',
        description: 'Set up your server configuration! (Owner only)'
    },
    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle(' ')
            .setDescription("Since our latest update you can only set the Bot up through our Dashboard on our Website!\n> **https://pfconnect.online/dashboard**")
            .setFooter({ text: "PFConnect Team" });

        await interaction.reply({ embeds: [embed], epheremal: true });
    }
};
