const db = require("../models");
const Tournament = db.Tournament;

const tournamentController = {
  createTournament: async (req, h) => {
    try {
      const {
        name,
        description,
        enroll_startDate,
        enroll_endDate,
        event_startDate,
        event_endDate,
      } = req.payload;

      // Check for duplicate name
      const existingTournament = await Tournament.findOne({ where: { name } });
      if (existingTournament) {
        return h.response({
          message: "Tournament name already exists",
        }).code(400);
      }
  
      // Convert dates to Date objects for comparison
      const enrollStart = new Date(enroll_startDate);
      const enrollEnd = new Date(enroll_endDate);
      const eventStart = new Date(event_startDate);
      const eventEnd = new Date(event_endDate);
  
      // Validate date sequence
      if (enrollStart >= enrollEnd) {
        return h.response({
          message: "Enrollment start date must be before enrollment end date",
        }).code(400);
      }
  
      if (enrollEnd >= eventStart) {
        return h.response({
          message: "Enrollment end date must be before event start date",
        }).code(400);
      }
  
      if (eventStart >= eventEnd) {
        return h.response({
          message: "Event start date must be before event end date",
        }).code(400);
      }
  
      // Create the tournament if dates are valid
      const newTournament = await Tournament.create({
        name,
        description,
        enroll_startDate,
        enroll_endDate,
        event_startDate,
        event_endDate,
      });
  
      return h.response({
        message: "Tournament created successfully",
        tournament: newTournament,
      }).code(201);
    } catch (error) {
      console.error("Error creating tournament:", error);
      return h.response({
        message: "Failed to create tournament",
        error: error.message,
      }).code(500);
    }
  },
  
  getAllTournaments: async (req, h) => {
    try {
      const tournaments = await Tournament.findAll();
      return h.response(tournaments).code(200);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      return h.response({
        message: "Failed to get tournaments",
        error: error.message,
      }).code(500);
    }
  },

  getTournamentDetails: async (req, h) => {
    try {
      const id = req.params.tournament_id;
      
      // Find tournament details
      const tournament = await Tournament.findByPk(id);
      
      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }
  
      // Calculate remaining time
      const now = new Date();
      const eventEndDate = new Date(tournament.event_endDate);
      const remainingTimeInSeconds = (eventEndDate - now) / 1000;
  
      // Individual score (example query from TournamentPoints)
      const individualScore = await TournamentPoints.sum('points', {
        where: { tournament_id: id, users_id: req.auth.credentials.user_id }
      });
  
      // Team scores and rank (reuse logic from getTournamentLeaderboard)
      const teamScores = await TeamScores.findAll({
        where: { tournament_id: id },
        attributes: ["team_id", "total_points", "updatedAt"],
        order: [
          ["total_points", "DESC"],
          ["updatedAt", "ASC"],
        ],
        include: [{ model: Team, attributes: ["name"] }],
      });
  
      const userTeamId = req.auth.credentials.team_id; // Example assumption
      const rankedLeaderboard = teamScores.map((entry, index) => ({
        team_id: entry.team_id,
        team_name: entry.Team.name,
        total_points: entry.total_points,
        rank: index + 1,
      }));
  
      const userTeamRank = rankedLeaderboard.find(rank => rank.team_id === userTeamId);
  
      return h.response({
        name: tournament.name,
        remainingTime: remainingTimeInSeconds,
        teamRank: userTeamRank ? userTeamRank.rank : null,
        teamScore: userTeamRank ? userTeamRank.total_points : null,
        individualScore: individualScore || 0,
      }).code(200);
  
    } catch (error) {
      console.error("Error fetching tournament details:", error);
      return h.response({
        message: "Failed to get tournament details",
        error: error.message,
      }).code(500);
    }
  },

  deleteTournamentById: async (req, h) => {
    try {
      const id = req.params.tournament_id;

      const tournament = await Tournament.findByPk(id);
      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      // Simply delete the tournament, cascade will handle related entries
      await Tournament.destroy({ where: { id } });

      return h.response({ message: "Tournament deleted successfully" }).code(200);
    } catch (error) {
      console.error("Error deleting tournament:", error);
      return h.response({
        message: "Failed to delete tournament",
        error: error.message,
      }).code(500);
    }
  },
  
};

module.exports = tournamentController;