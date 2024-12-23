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
      const leaderboard = await TeamScores.findAll({
        where: { tournament_id }, // Filter by tournament_id
        attributes: ["team_id", "total_points", "updatedAt"], // Fetch necessary fields
        order: [
          ["total_points", "DESC"], // Order by total points descending
          ["updatedAt", "ASC"], // Break ties using updatedAt (earliest first)
        ],
        include: [
          {
            model: db.Team, // Join with the Teams table
            attributes: ["id", "name"], // Fetch team names
          },
        ],
        limit: 6, // Fetch only the top 6 entries
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
  
  updateTeamScore: async (request, h) => {
    const { tournament_id } = request.params; // From the path
    const { team_id, total_points } = request.payload; // From the body
  
    try {
      // Update the total_points where team_id and tournament_id match
      const [updatedRowsCount] = await TeamScores.update(
        { total_points }, // Fields to update
        {
          where: {
            team_id,
            tournament_id,
          },
        }
      );
  
      // Check if any rows were updated
      if (updatedRowsCount === 0) {
        return h.response({
          message: "No matching record found to update. Check team_id and tournament_id.",
        }).code(404);
      }
  
      return h.response({
        message: "Team score updated successfully",
        updatedFields: {
          team_id,
          tournament_id,
          total_points,
        },
      }).code(200);
    } catch (error) {
      console.error("Error updating team score:", error);
      return h.response({
        message: "Failed to update team score",
        error: error.message,
      }).code(500);
    }
  },
  
};

module.exports = lbController;
