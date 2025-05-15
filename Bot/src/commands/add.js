const { addUserToTicket } = require("../functions/ticketFunctions");
const { loadGuildData } = require("../functions/api_utils");

module.exports = {
    data: {
        name: "add",
        description: "Add a user to the current ticket (Staff only)",
        options: [
            {
                name: "user",
                type: 6,
                description: "The user to add to the ticket.",
                required: true,
            },
        ],
    },

    async execute(interaction) {
        const member = interaction.member;
        const guildId = interaction.guild.id;
        const guildData = await loadGuildData(guildId);
        const staffRoles = guildData?.staffRoles || [];
        const hasStaffRole = staffRoles.some((roleId) => member.roles.cache.has(roleId));

        if (!hasStaffRole) {
            return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
        }

        const user = interaction.options.getUser("user");
        await addUserToTicket(interaction, user);
    },
};
