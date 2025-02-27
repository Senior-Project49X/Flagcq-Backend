"use strict";

const lbController = require("../controllers/lbController");

const lbRoute = [
  {
    method: "GET",
    path: "/api/lb",
    handler: lbController.getPracticeLeaderboard, // Renamed for clarity
  },
];

module.exports = lbRoute;
