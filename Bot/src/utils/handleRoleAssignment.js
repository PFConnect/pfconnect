const { saveFlightData } = require("../functions/api_utils.js");
const { loadGuildData } = require("../functions/api_utils.js");
const client = require("../clientInstance");
const { EmbedBuilder } = require("discord.js");
const { BANNER } = require("../config");

const permissionMessageSent = new Set();
const errorStats = {
    noValidUserData: 0,
    unknownMember: 0,
    unknownRole: 0,
    permissionErrors: 0,
    channelErrors: 0,
    otherErrors: 0,
    otherErrorDescriptions: [],
};

const handleRoleAssignment = async (guildId, userId, role_id, points, userData, promotionSent, rankupChannel) => {
    try {
        if (!client) throw new Error("Discord client is not available");
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = await guild.members.fetch(userId).catch((err) => {
            if (err.code === 10007) {
                // Unknown Member
                errorStats.unknownMember++;
            }
            throw err;
        });
        if (!member || member.roles.cache.has(role_id)) return;

        const roleObj = guild.roles.cache.get(role_id);
        if (!roleObj) {
            errorStats.unknownRole++;
            throw new Error(`Unknown Role: ${role_id}`);
        }

        await member.roles.add(role_id);
        userData[guildId].users[userId].promotionSent = userData[guildId].users[userId].promotionSent || {};
        userData[guildId].users[userId].promotionSent[role_id] = true;

        await saveFlightData(guildId, userData);

        const guildData = await loadGuildData(guildId);

        if (!guildData?.rankupChannel) {
            return;
        }

        const roleName = roleObj?.name || `Role (${role_id})`;

        const embed = new EmbedBuilder()
            .setColor(guildData?.rankupColor || "#F2F3F5")
            .setTitle(guildData?.rankupTitle || "🎉 New Promotion! �")
            .setDescription(
                (
                    guildData?.rankupDescription ||
                    `### 🎉 Congratulations, <@${userId}>!\nYou've been promoted to {rank}! 🏆\nYour dedication and hard work have truly paid off.\n\nWe're excited to see what you'll accomplish next!\nKeep pushing forward! 🚀`
                )
                    .replace(/{rank}/g, `<@&${role_id}>`)
                    .replace(/{user}/g, `<@${userId}>`)
                    .replace(/{server}/g, guild.name)
            )
            .setFooter({ text: guildData?.rankupFooter || "Keep up the great work!" })
            .setImage(guildData?.bannerUrl || BANNER);

        try {
            const channel = await guild.channels.fetch(guildData.rankupChannel);
            if (channel) {
                await channel.send({ content: `<@${userId}>`, embeds: [embed] });
            } else {
                errorStats.channelErrors++;
            }
        } catch (channelError) {
            errorStats.channelErrors++;
        }
    } catch (error) {
        if (error.code === 50013 || error.code === 50001) {
            errorStats.permissionErrors++;
            const guild = client.guilds.cache.get(guildId);
            if (guild && !permissionMessageSent.has(guildId)) {
                try {
                    const owner = await guild.fetchOwner();
                    if (owner) {
                        let errorMessage;
                        if (error.code === 50013) {
                            errorMessage = `🚨 **Permission Error on ${guild.name}**\n\n**Problem:**  \nPFConnect Bot failed to assign a role because it's missing required permissions.\n\n**Details:**  \n• Attempted to assign role: ${role_id}  \n• To user: ${userId}  \n• Required permission: \`Manage Roles\`\n\n**How to Fix:**  \n1. Go to **Server Settings** → **Roles**  \n2. Make sure the bot's role is **above** the role it's trying to assign  \n3. Verify the bot has these permissions:  \n✅ Manage Roles  \n✅ View Channels  \n✅ Send Messages\n\nNeed help? Join our support server: https://discord.gg/tNURxzY2tP`;
                        } else {
                            errorMessage = `🚨 **Access Error on ${guild.name}**\n\n**Problem:**  \nPFConnect Bot failed to assign a role because it doesn't have access to the channel.\n\n**Details:**  \n• Attempted to assign role: ${role_id}  \n• To user: ${userId}  \n• Error: Missing Access (50001)\n\n**How to Fix:**  \n1. Go to **Server Settings** → **Roles**  \n2. Make sure the bot has access to the rankup channel  \n3. Verify the bot has these permissions in the channel:  \n✅ View Channel  \n✅ Send Messages\n\nNeed help? Join our support server: https://discord.gg/tNURxzY2tP`;
                        }

                        try {
                            await owner.send(errorMessage);
                            permissionMessageSent.add(guildId);
                        } catch (dmError) {
                            const publicChannel = guild.systemChannel || guild.publicUpdatesChannel;
                            if (publicChannel) {
                                await publicChannel.send(
                                    `<@${owner.id}>, ${
                                        errorMessage.split("\n")[0]
                                    }\n(I couldn't DM you - please enable DMs from server members)`
                                );
                            }
                        }
                    }
                } catch (dmError) {
                    // Silently fail
                }
            }
        } else if (error.code === 10007) {
            // Unknown Member
            errorStats.unknownMember++;
        } else if (error.code === 10011) {
            // Unknown Role
            errorStats.unknownRole++;
        } else {
            errorStats.otherErrors++;
            // Store first 3 words of error message for summary
            const shortDesc = error.message.split(" ").slice(0, 3).join(" ");
            errorStats.otherErrorDescriptions.push(shortDesc);
        }
    }
};

const getRoleAssignmentStats = () => {
    return errorStats;
};

const resetRoleAssignmentStats = () => {
    errorStats.noValidUserData = 0;
    errorStats.unknownMember = 0;
    errorStats.unknownRole = 0;
    errorStats.permissionErrors = 0;
    errorStats.channelErrors = 0;
    errorStats.otherErrors = 0;
    errorStats.otherErrorDescriptions = [];
};

module.exports = { handleRoleAssignment, getRoleAssignmentStats, resetRoleAssignmentStats };
