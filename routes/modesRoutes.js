"use strict";

const modeController = require("../controllers/modesController");

const modeRoute = [
  {
    method: "GET",
    path: "/api/modes",
    handler: modeController.getAllModes,
  },
  {
    method: "POST",
    path: "/api/modes",
    handler: modeController.createMode,
  },
  {
    method: "DELETE",
    path: "/api/modes/{id}",
    handler: modeController.deleteMode,
  },
  {
    method: "GET",
    path: "/api/modes/{id}",
    handler: modeController.getModeById,
  },
  {
    method: "GET",
    path: "/api/modes/name/{name}",
    handler: modeController.getModeByName,
  },
];

module.exports = modeRoute;
