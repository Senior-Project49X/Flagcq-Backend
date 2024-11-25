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
  },
];

module.exports = teamRoutes;
