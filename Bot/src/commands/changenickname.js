const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { UNIVERSAL_ADMIN_IDS } = require("../config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("changenickname")
        .setDescription("Change the nickname of the Bot on a specific Server.")
        .addStringOption((option) =>
            option.setName("nickname").setDescription("The new nickname for the bot").setRequired(true)
        ),

    async execute(interaction) {
        if (!UNIVERSAL_ADMIN_IDS.includes(interaction.user.id)) {
            return interaction.reply({
                content: "Only the System Administrator can run this command!",
                ephemeral: true,
            });
        }
        const newNickname = interaction.options.getString("nickname");
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);

        try {
            await botMember.setNickname(newNickname);
            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setDescription(`Successfully changed the bot's nickname to **${newNickname}**`);

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: "There was an error while changing the nickname.",
                ephemeral: true,
            });
        }
    },
};
