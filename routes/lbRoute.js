"use strict";

const lbController = require("../controllers/lbController");

const lbRoute = [
  {
    method: "GET",
    path: "/api/lb",
    handler: lbController.getLeaderboard,
  },
];

module.exports = lbRoute;
