const { loadGuildData, loadFlightData } = require("../functions/api_utils");
const { handleRoleAssignment, getRoleAssignmentStats, resetRoleAssignmentStats } = require("./handleRoleAssignment");
const client = require("../clientInstance");

const assignRoles = async () => {
    const guilds = client.guilds.cache;
    resetRoleAssignmentStats();

    for (const [guildId, guild] of guilds) {
        try {
            const guildData = await loadGuildData(guildId);
            if (!guildData) continue;

            const { rankupChannel, pilotRoles } = guildData;

            if (!Array.isArray(pilotRoles)) continue;

            const userData = await loadFlightData(guildId);
            if (!userData || !userData[guildId]?.users) {
                errorStats.noValidUserData++;
                continue;
            }

            for (const userId in userData[guildId].users) {
                try {
                    const userFlights = userData[guildId].users[userId].totalPoints || 0;
                    const promotionSent = userData[guildId].users[userId].promotionSent || {};

                    for (const { flights: requiredFlights, role } of pilotRoles) {
                        if (!role || requiredFlights === undefined) continue;

                        if (userFlights >= requiredFlights) {
                            await handleRoleAssignment(
                                guildId,
                                userId,
                                role,
                                requiredFlights,
                                userData,
                                userData[guildId].users[userId].promotionSent || {},
                                rankupChannel
                            );
                        }
                    }
                } catch (userError) {
                    // Errors are handled in handleRoleAssignment
                }
            }
        } catch (guildError) {
            // Errors are handled in handleRoleAssignment
        }
    }

    // Print summary
    const stats = getRoleAssignmentStats();
    const now = new Date();
    const timestamp = now.toISOString();

    let summary = `
++++++++++Assigning Role Errors++++++++++
No Valid User Data: ${stats.noValidUserData}
Unknown Member: ${stats.unknownMember}
Unknown Role: ${stats.unknownRole}
Permission Errors: ${stats.permissionErrors}
Channel Errors: ${stats.channelErrors}`;

    if (stats.otherErrors > 0) {
        const uniqueDescriptions = [...new Set(stats.otherErrorDescriptions)];
        summary += `\nOther Errors (${stats.otherErrors}): ${uniqueDescriptions.slice(0, 3).join(", ")}${
            uniqueDescriptions.length > 3 ? "..." : ""
        }`;
    }

    summary += `
+++++++++++++++++++++++++++++++++++++++++
Timestamp: ${timestamp}
`;

    console.log(summary);
};

module.exports = { assignRoles };
