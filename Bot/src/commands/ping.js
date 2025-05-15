const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: 'ping',
        description: 'Check the bot\'s ping and latency.'
    },

    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const ping = sent.createdTimestamp - interaction.createdTimestamp;
    
        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('🏓 Pong!')
            .setDescription(`**Latency:** ${ping}ms`)
            .setFooter({ text: 'Ping-Pong Command', iconURL: interaction.client.user.displayAvatarURL() })
            .setTimestamp();
    
        await interaction.editReply({ content: null, embeds: [embed] });
    }
};
