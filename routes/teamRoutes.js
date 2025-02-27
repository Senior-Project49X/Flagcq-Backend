"use strict";

const teamController = require("../controllers/teamController");

const teamRoutes = [
  {
    method: "POST",
    path: "/api/teams/join",
    handler: teamController.joinTeam,
  },
  {
    method: "POST",
    path: "/api/teams/create",
    handler: teamController.createTeam,
  },
  {
    method: "GET",
    path: "/api/teams/{tournament_id}/{team_id}",
    handler: teamController.getTeamScores,
  },
  {
    method: "GET",
    path: "/api/teams/member_page/{tournament_id}/{team_id}",
    handler: teamController.getTeamMemberPage,
    options: {
      description: "Get team members",
      notes: "Fetches all members of a specific team within a tournament.",
      tags: ["api", "team"], // Tags for documentation plugins like Swagger
    },
  },
  {
    method: "DELETE",
    path: "/api/teams/{tournament_id}",
    handler: teamController.deleteTeam,
    options: {
      description: "Delete a team and its members",
      notes:
        "Allows the team leader to delete the team and remove all members.",
      tags: ["api", "team"], // Tags for documentation plugins like Swagger
    },
  },
  {
    method: "DELETE",
    path: "/api/teams/member_page/{team_id}/{member_id}",
    handler: teamController.kickTeamMember,
    options: {
      description: "Kick a member from the team",
      notes: "Allows the team leader to kick a member from the team.",
      tags: ["api", "team"], // Tags for documentation plugins
    },
  },
  {
    method: "DELETE",
    path: "/api/teams/{team_id}/leave",
    handler: teamController.leaveTeam,
  },
];

module.exports = teamRoutes;
