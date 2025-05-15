const {SlashCommandBuilder, EmbedBuilder, embedLength} = require("discord.js");
const { ICON, BANNER } = require("../config");

module.exports = {
    data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Creates reactionroles")
    .addBooleanOption((option) =>  option.setName("newmessage").setDescription('Click “TRUE” to post a new message or “FALSE” to add reactions to an existing one.').setRequired(true))
    .addStringOption((option) => option.setName("emoji_1").setDescription("please enter the emoji you want for this reaction1").setRequired(true))
    .addRoleOption((option) => option.setName("role_1").setDescription("What role should reaction 1 give").setRequired(true))
    .addStringOption((option) => option.setName('messageid').setDescription('If you chose FALSE earlier, enter the target message’s ID. Otherwise, leave this blank.').setRequired(false))
    .addStringOption((option) => option.setName("content").setDescription("If you chose TRUE earlier, enter the message you want the bot to send").setRequired(false))
    .addStringOption((option) => option.setName("emoji_2").setDescription("please enter the emoji you want for this reaction2 ").setRequired(false))
    .addStringOption((option) => option.setName("emoji_3").setDescription("please enter the emoji you want for this reaction3").setRequired(false))
    .addStringOption((option) => option.setName("emoji_4").setDescription("please enter the emoji you want for this reaction4").setRequired(false))
    .addStringOption((option) => option.setName("emoji_5").setDescription("please enter the emoji you want for this reaction5").setRequired(false))
    .addRoleOption((option) => option.setName("role_2").setDescription("What role should reaction 2 give").setRequired(false))
    .addRoleOption((option) => option.setName("role_3").setDescription("What role should reaction 3 give").setRequired(false))
    .addRoleOption((option) => option.setName("role_4").setDescription("What role should reaction 4 give").setRequired(false))
    .addRoleOption((option) => option.setName("role_5").setDescription("What role should reaction 5 give").setRequired(false)),
    async execute(interaction) {
        const { loadGuildData } = require("../functions/api_utils");
        await interaction.deferReply({ ephemeral: true })
        const guildData = await loadGuildData(interaction.guild.id)
        const member = interaction.member
               const isStaff = guildData.staffRoles?.some((role) => member.roles.cache.has(role));
            if (!isStaff) {
                return interaction.editReply("You do not have permission to use this command")
                
            }
        if (!interaction.client.reactionRoleMap) {
            interaction.client.reactionRoleMap = new Map();
        }

        const isNew = interaction.options.getBoolean("newmessage")
        const mappings = [];
        for (let i = 1; i <= 5; i++) {
            const emoji = interaction.options.getString(`emoji_${i}`)
            const role = interaction.options.getRole(`role_${i}`)
            if (emoji && role) mappings.push({ emoji, roleId: role.id })
        }

        let targetMessage
        if (isNew) {
            const content = interaction.options.getString("content")
            if (!content) {
                await interaction.editReply({ content: 'You must fill in the "content" field if you select "TRUE" for the "newmessage" field', ephermeral: true })
            }

            const embed = new EmbedBuilder()
            .setTitle(content)
            .setImage(BANNER)

            targetMessage = await interaction.channel.send({ embeds: [embed] })
        } else {
            const messageId = interaction.options.getString("messageid")
            if (!messageId) {
                await interaction.editReply({ content: 'You must provide a message id when you click "FALSE" for the "newmessage" field', ephermeral: true })
            }
            try {
                targetMessage = await interaction.channel.messages.fetch(messageId)
            } catch(error) {
                await interaction.editReply({ content: `Could not find a message with the id ${messageId} in this channel. \n Please make sure to run this command in the same channel as the message you want to add the reaction to n\ Error Message: ${error.message}`, ephermeral: true })
            }
        }
        for (const { emoji } of mappings) {
            try {
                await targetMessage.react(emoji)
            } catch(error) {
                await interaction.editReply({ content: "Failed to add a reaction to the message, please make sure you enter a valid emoji into the emoji field", ephermeral: true })
            }
        }
        interaction.client.reactionRoleMap.set(
            targetMessage.id,
            mappings.reduce((o, { emoji, roleId }) => {
                o[emoji] = roleId;
                return o
            }, {})
        );
        await interaction.editReply({ content: "Reaction role created", ephermeral: true })
    }
}