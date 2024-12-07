"use strict";

const lbController = require("../controllers/lbController");

const lbRoute = [
  {
    method: "GET",
    path: "/api/lb",
    handler: lbController.getPracticeLeaderboard, // Renamed for clarity
  },
  {
    method: "GET",
    path: "/api/lb/tournament/{tournament_id}", // Path parameter for tournament mode
    handler: lbController.getTournamentLeaderboard,
  },
];

module.exports = lbRoute;
