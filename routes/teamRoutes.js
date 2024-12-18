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
    method: "POST",
    path: "/teams/createmock",
    handler: teamController.createTeamMock,
  },{
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
