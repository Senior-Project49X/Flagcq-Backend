"use strict";

const db = require("../models");
const User = db.User;
const Point = db.Point;
const TournamentPoints = db.TournamentPoints; // Assuming this model exists for storing tournament-specific points

const lbController = {
  // Leaderboard for practice mode
  getPracticeLeaderboard: async (request, h) => {
    try {
      const leaderboard = await Point.findAll({
        attributes: ["points"],
        order: [
          ["points", "DESC"],
          ["updatedAt", "ASC"],
        ],
        include: [
          {
            model: User,
            attributes: ["first_name", "last_name"],
          },
        ],
      });

      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        ...entry.dataValues,
        rank: index + 1,
      }));

      return h.response(rankedLeaderboard).code(200);
    } catch (error) {
      console.error("Error fetching practice leaderboard:", error);
      return h.response({ message: "Failed to fetch leaderboard" }).code(500);
    }
  },

  // Leaderboard for tournament mode
  getTournamentLeaderboard: async (request, h) => {
    const { tournament_id } = request.params; // Get tournament_id from the URL

    try {
      const leaderboard = await TournamentPoints.findAll({
        where: { tournament_id }, // Filter by tournament_id
        attributes: ["points"],
        order: [
          ["points", "DESC"],
          ["updatedAt", "ASC"],
        ],
        include: [
          {
            model: User,
            as: "user", // Match alias defined in TournamentPoints model
            attributes: ["first_name", "last_name"],
          },
        ],
      });

      if (!leaderboard.length) {
        return h.response({ message: "No leaderboard data found for this tournament." }).code(404);
      }

      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        ...entry.dataValues,
        rank: index + 1,
      }));

      return h.response(rankedLeaderboard).code(200);
    } catch (error) {
      console.error("Error fetching tournament leaderboard:", error);
      return h.response({ message: "Failed to fetch tournament board" }).code(500);
    }
  },
};

module.exports = lbController;
