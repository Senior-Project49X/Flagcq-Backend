"use strict";

const db = require("../models");
const User = db.User;
const Point = db.Point;
const TournamentPoints = db.TournamentPoints; // Assuming this model exists for storing tournament-specific points
const TeamScores = db.TeamScores; // Assuming the TeamScores model exists

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
      // Fetch the leaderboard using the TeamScores table
      const leaderboard = await db.TeamScores.findAll({
        where: { tournament_id }, // Filter by tournament_id
        attributes: ["team_id", "total_points"],
        order: [["total_points", "DESC"]],
        include: [
          {
            model: db.Team, // Join with the Teams table
            attributes: ["name"], // Fetch team names
          },
        ],
      });

      if (!leaderboard.length) {
        return h.response({ message: "No leaderboard data found for this tournament." }).code(404);
      }

      // Map the leaderboard to include rank and team name
      const rankedLeaderboard = leaderboard.map((entry, index) => ({
        team_id: entry.team_id,
        team_name: entry.Team.name,
        total_points: entry.total_points,
        rank: index + 1,
      }));

      return h.response(rankedLeaderboard).code(200);
    } catch (error) {
      console.error("Error fetching tournament leaderboard:", error);
      return h.response({ message: "Failed to fetch tournament leaderboard" }).code(500);
    }
  },
  
  createTeamScore: async (request, h) => {
    const { tournament_id } = request.params; // From the path
    const { id,team_id, total_points } = request.payload; // From the body

    try {
      // Create a new entry in TeamScores
      const teamScore = await TeamScores.create({
        team_id,
        tournament_id,
        total_points,
      });

      return h.response({ message: "Team score created successfully", data: teamScore }).code(201);
    } catch (error) {
      console.error("Error creating team score:", error);
      return h.response({ message: "Failed to create team score" }).code(500);
    }
  },
};

module.exports = lbController;
