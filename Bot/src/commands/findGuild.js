const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("findguild")
        .setDescription("Find a server by its ID")
        .addStringOption((option) =>
            option.setName("guild_id").setDescription("The ID of the server to find").setRequired(true)
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guildId = interaction.options.getString("guild_id");
            const guild = interaction.client.guilds.cache.get(guildId);

            if (!guild) {
                return interaction.editReply({
                    content: `❌ I couldn't find a server with ID \`${guildId}\`.\nMake sure:
                    - The ID is correct
                    - I'm a member of that server
                    - You have permission to view this information`,
                    ephemeral: true,
                });
            }

            const embed = new EmbedBuilder()
                .setColor("#000000")
                .setTitle("Server Information")
                .addFields(
                    { name: "Server Name", value: guild.name, inline: true },
                    { name: "Server ID", value: guild.id, inline: true },
                    { name: "Member Count", value: guild.memberCount.toString(), inline: true },
                    { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
                    { name: "Created At", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: true }
                )
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Error in findGuild command:", error);
            if (!interaction.replied) {
                await interaction.editReply({
                    content: "❌ An error occurred while processing your request.",
                    ephemeral: true,
                });
            }
        }
    },
};
