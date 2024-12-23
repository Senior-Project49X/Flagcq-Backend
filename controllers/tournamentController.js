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

  getTournamentById: async (req, h) => {
    try {
      const id = req.params.tournament_id;
      const tournament = await Tournament.findByPk(id);
      
      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      return h.response(tournament).code(200);
    } catch (error) {
      console.error("Error fetching tournament by ID:", error);
      return h.response({
        message: "Failed to get tournament",
        error: error.message,
      }).code(500);
    }
  }
};

module.exports = tournamentController;