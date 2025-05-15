const { PermissionsBitField } = require("discord.js");
const { loadGuildData } = require("../functions/api_utils");
const { closeTicket } = require("../functions/ticketFunctions");
const { isTicketChannel } = require("../functions/ticketChannels");

module.exports = {
    data: {
        name: "close",
        description: "Close this ticket (Staff only).",
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const member = interaction.member;
        const guildData = await loadGuildData(guildId);
        const staffRoles = guildData?.staffRoles || [];
        const hasStaffRole =
            staffRoles.some((roleId) => member.roles.cache.has(roleId)) || member.id === "798485492621770792";

        if (!hasStaffRole) {
            return interaction.editReply({
                content: "You do not have permission to use this command.",
            });
        }

        if (!isTicketChannel(guildId, interaction.channel.id)) {
            return interaction.editReply({
                content: "This channel is not a valid ticket channel.",
            });
        }

        // Pass true for isDeferred and true for isSlashCommand
        await closeTicket(interaction, true, true);
    },
};
