const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { loadGuildData, saveGuildData } = require("../functions/api_utils");
const { UNIVERSAL_ADMIN_IDS } = require("../config");

module.exports = {
    data: {
        name: "ticket_ban",
        description: "Ban a user from creating tickets.",
        options: [
            {
                type: 6,
                name: "user",
                description: "The user to ban from creating tickets.",
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

            if (!guildData.bannedUsers) {
                guildData.bannedUsers = [];
            }

            if (guildData.bannedUsers.includes(user.id)) {
                return interaction.editReply({
                    content: `${user.tag} is already banned from creating tickets.`,
                    ephemeral: true,
                });
            }

            guildData.bannedUsers.push(user.id);
            await saveGuildData(guild.id, guildData);

            const embed = new EmbedBuilder()
                .setColor("#FF0000")
                .setTitle("Ticket Ban")
                .setDescription(`${user.tag} has been banned from creating tickets.`)
                .setFooter({ text: `Banned by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], ephemeral: true });

            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor("#FF0000")
                    .setTitle("Ticket Ban Notification")
                    .setDescription(`You have been banned from creating tickets in ${guild.name}.`)
                    .setFooter({ text: "Contact server staff if you believe this is a mistake" })
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.error(`Could not send DM to ${user.tag}:`, dmError);
            }
        } catch (error) {
            console.error("Error executing ticket_ban command:", error);
            await interaction.editReply({
                content: "There was an error while trying to ban this user from tickets.",
                ephemeral: true,
            });
        }
    },
};
