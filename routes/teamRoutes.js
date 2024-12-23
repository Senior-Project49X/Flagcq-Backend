"use strict";

const teamController = require("../controllers/teamController");

const teamRoutes = [
  {
    method: "POST",
    path: "/teams/join",
    handler: teamController.joinTeam,
  },{
    method: "POST",
    path: "/teams/create",
    handler: teamController.createTeam,
  },{
    method: "GET",
    path: "/teams/tournament/{tournament_id}",
    handler: teamController.getAllTeamsInTournament,
    options: {
      description: "Get all teams in a specific tournament",
      notes: "Returns all teams with their members for a given tournament ID.",
      tags: ["api", "teams"],
    },
  },{
    // for test
    method: "POST",
    path: "/teams/createmock",
    handler: teamController.createTeamMock,
  },{
    // for test
    method: "POST",
    path: "/teams/fakejoin",
    handler: teamController.joinFakeTeam,
  },{
    method: "GET",
    path: "/teams/{tournament_id}/{team_id}",
    handler: teamController.getTeamScores,
  },
];

module.exports = teamRoutes;
