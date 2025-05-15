const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { loadGuildData, saveGuildData } = require("../functions/api_utils");
const { UNIVERSAL_ADMIN_IDS } = require("../config");

module.exports = {
    data: {
        name: "ticket_unban",
        description: "Unban a user from creating tickets.",
        options: [
            {
                type: 6,
                name: "user",
                description: "The user to unban from creating tickets.",
                required: true,
            },
        ],
    },

    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const user = interaction.options.getUser("user");
            const member = interaction.member;

            const guildData = await loadGuildData(guild.id);

            const isStaff = guildData.staffRoles?.some((role) => member.roles.cache.has(role));
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const isUniversalAdmin = UNIVERSAL_ADMIN_IDS.includes(interaction.user.id);
            const isOwner = interaction.user.id === guild.ownerId;

            if (!isStaff && !isAdmin && !isOwner && !isUniversalAdmin) {
                return interaction.editReply({
                    content: "You don't have permission to use this command.",
                    ephemeral: true,
                });
            }

            if (!guildData.bannedUsers || guildData.bannedUsers.length === 0) {
                return interaction.editReply({
                    content: "There are no currently banned users.",
                    ephemeral: true,
                });
            }

            const userIndex = guildData.bannedUsers.indexOf(user.id);
            if (userIndex === -1) {
                return interaction.editReply({
                    content: `${user.tag} is not currently banned from creating tickets.`,
                    ephemeral: true,
                });
            }

            guildData.bannedUsers.splice(userIndex, 1);
            await saveGuildData(guild.id, guildData);

            const embed = new EmbedBuilder()
                .setColor("#00FF00")
                .setTitle("Ticket Unban")
                .setDescription(`${user.tag} has been unbanned and can now create tickets again.`)
                .setFooter({ text: `Unbanned by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor("#00FF00")
                    .setTitle("Ticket Unban Notification")
                    .setDescription(`You have been unbanned from creating tickets in ${guild.name}.`)
                    .setFooter({ text: "You can now create tickets again" })
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.error(`Could not send DM to ${user.tag}:`, dmError);
            }
        } catch (error) {
            console.error("Error executing ticket_unban command:", error);
            await interaction.editReply({
                content: "There was an error while trying to unban this user from tickets.",
                ephemeral: true,
            });
        }
    },
};
