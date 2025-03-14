"use strict";

const Joi = require("joi");
const tournamentController = require("../controllers/tournamentController");
const path = require("path");

const tournamentRoutes = [
  {
    method: "POST",
    path: "/api/createTournament",
    handler: tournamentController.createTournament,
  },
  {
    method: "PUT", // Using PUT for updates
    path: "/api/editTournament",
    handler: tournamentController.editTournament,
    options: {
      description: "Edit a tournament",
      notes: "Updates details of a tournament. Only admins can edit.",
      tags: ["api", "tournaments"],
    },
  },
  {
    method: "GET",
    path: "/api/tournaments",
    handler: tournamentController.getAllTournaments,
    options: {
      description: "Get all tournaments",
      notes: "Returns a list of all tournaments.",
      tags: ["api", "tournaments"],
    },
  },
  {
    method: "GET",
    path: "/api/joinedTournament",
    handler: tournamentController.getJoinedTournaments,
    options: {
      description: "Get all joined tournaments",
      notes: "Returns a list of all joined tournaments. For MyTeam Page",
      tags: ["api", "tournaments"],
    },
  },
  {
    method: "GET",
    path: "/api/info/{tournament_id}",
    handler: tournamentController.getAllInfoInTournament,
    options: {
      description: "Get all teams information in a specific tournament",
      notes: "Returns all teams with their members for a given tournament ID.",
      tags: ["api", "teams"],
    },
  },
  {
    method: "GET",
    path: "/api/myTeamInfo/{tournament_id}",
    handler: tournamentController.getMyTeamInfoInTournament,
    options: {
      description: "Get all teams information in a specific tournament",
      notes: "Returns all teams with their members for a given tournament ID.",
      tags: ["api", "teams"],
    },
  },
  {
    method: "GET",
    path: "/api/tournaments/{tournament_id}",
    handler: tournamentController.getTournamentDetails,
    options: {
      validate: {
        params: Joi.object({
          tournament_id: Joi.number().integer().required().messages({
            "number.base": "Tournament ID must be a number.",
            "any.required": "Tournament ID is required.",
          }),
        }),
      },
      description: "Get a tournament details of that User by tourID",
      notes: "Returns details of a tournament by its ID.",
      tags: ["api", "tournaments"],
    },
  },
  {
    method: "DELETE",
    path: "/api/tournaments/{tournament_id}",
    handler: tournamentController.deleteTournamentById,
    options: {
      validate: {
        params: Joi.object({
          tournament_id: Joi.number().integer().required().messages({
            "number.base": "Tournament ID must be a number.",
            "any.required": "Tournament ID is required.",
          }),
        }),
      },
      description: "Delete a tournament by ID",
      notes: "Deletes a tournament and all related data by its ID.",
      tags: ["api", "tournaments"],
    },
  },
  {
    method: "GET",
    path: "/api/tournamentID/{id}",
    handler: tournamentController.getTournamentById,
  },
  {
    method: "GET",
    path: "/api/tournaments/list",
    handler: tournamentController.getAllTournamentList,
  },
  {
    method: "DELETE",
    path: "/api/admin/deleteTeam",
    handler: tournamentController.adminDeleteTeam,
    options: {
      validate: {
        payload: Joi.object({
          teamId: Joi.number().integer().required().messages({
            "number.base": "Team ID must be a number.",
            "any.required": "Team ID is required.",
          }),
          tournamentId: Joi.number().integer().required().messages({
            "number.base": "Tournament ID must be a number.",
            "any.required": "Tournament ID is required.",
          }),
        }),
      },
      description: "Admin delete team",
      notes: "Allows admin to delete a team from a tournament. Requires admin privileges.",
      tags: ["api", "admin", "teams"],
    },
  },
  {
    method: "DELETE",
    path: "/api/admin/kickMember",
    handler: tournamentController.adminKickTeamMember,
    options: {
      validate: {
        payload: Joi.object({
          teamId: Joi.number().integer().required().messages({
            "number.base": "Team ID must be a number.",
            "any.required": "Team ID is required.",
          }),
          memberIdToKick: Joi.string().required().messages({
            "number.base": "Member ID must be a number.",
            "any.required": "Member ID is required.",
          }),
        }),
      },
      description: "Admin kick team member",
      notes: "Allows admin to kick a member from a team. Requires admin privileges.",
      tags: ["api", "admin", "teams"],
    },
  },
];

module.exports = tournamentRoutes;
