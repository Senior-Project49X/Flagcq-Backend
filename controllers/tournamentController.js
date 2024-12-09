// "use strict";

// const db = require("../models");
// const Tournament = db.Tournament;

// const tournamentController = {
//   createTournament: async (req, h) => {
//     try {
//       const { user } = req.auth.credentials; // Assuming you're using authentication middleware
//       const { name, description, enroll_startDate, enroll_endDate, event_startDate, event_endDate } = req.payload;

//       // Check if the user has an admin account type
//       if (user.AccType !== "Admin") {
//         return h.response({ message: "Unauthorized: Only admins can create tournaments." }).code(403);
//       }

//       // Validate input dates
//       const enrollStart = new Date(enroll_startDate);
//       const enrollEnd = new Date(enroll_endDate);
//       const eventStart = new Date(event_startDate);
//       const eventEnd = new Date(event_endDate);

//       if (enrollStart >= enrollEnd || eventStart >= eventEnd || enrollEnd > eventStart) {
//         return h.response({
//           message: "Invalid dates: Ensure logical ordering of enroll and event times.",
//         }).code(400);
//       }

//       // Create a new tournament
//       const newTournament = await Tournament.create({
//         name,
//         description,
//         enroll_startDate: enrollStart,
//         enroll_endDate: enrollEnd,
//         event_startDate: eventStart,
//         event_endDate: eventEnd,
//       });

//       return h.response({ message: "Tournament created successfully!", tournament: newTournament }).code(201);
//     } catch (error) {
//       console.error("Error creating tournament:", error);
//       return h.response({ message: "Failed to create tournament." }).code(500);
//     }
//   },
// };

// module.exports = tournamentController;

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
      } = req.payload; // Extract input data from request payload

      // Create the tournament in the database
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
};

module.exports = tournamentController;
