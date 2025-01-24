const db = require("../models");
const { Team, Users_Team, TeamScores, User, TournamentPoints, Tournament } = db;
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");

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
        return h
          .response({
            message: "Tournament name already exists",
          })
          .code(400);
      }

      // Convert dates to Date objects for comparison
      const enrollStart = new Date(enroll_startDate);
      const enrollEnd = new Date(enroll_endDate);
      const eventStart = new Date(event_startDate);
      const eventEnd = new Date(event_endDate);

      // Validate date sequence
      if (enrollStart >= enrollEnd) {
        return h
          .response({
            message: "Enrollment start date must be before enrollment end date",
          })
          .code(400);
      }

      if (enrollEnd >= eventStart) {
        return h
          .response({
            message: "Enrollment end date must be before event start date",
          })
          .code(400);
      }

      if (eventStart >= eventEnd) {
        return h
          .response({
            message: "Event start date must be before event end date",
          })
          .code(400);
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

      return h
        .response({
          message: "Tournament created successfully",
          tournament: newTournament,
        })
        .code(201);
    } catch (error) {
      console.error("Error creating tournament:", error);
      return h
        .response({
          message: "Failed to create tournament",
          error: error.message,
        })
        .code(500);
    }
  },

  getAllTournaments: async (req, h) => {
    try {
      // const tournaments = await Tournament.findAll();
      // return h.response(tournaments).code(200);

      const { page = 1 } = req.query;
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h
          .response({ message: "Unauthorized: Invalid token." })
          .code(401);
      }

      // Retrieve user
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { student_id: decoded.student_id },
            { itaccount: decoded.email },
          ],
        },
      });

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      const userId = user.user_id;
      const parsedPage = parseInt(page, 10);
      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 4; // Number of tournaments per page
      const offset = (parsedPage - 1) * limit;

      // Fetch all tournaments
      // const tournaments = await Tournament.findAll({
      //   include: {
      //     model: Team,
      //     attributes: ['id', 'tournament_id'],
      //     include: {
      //       model: Users_Team,
      //       where: { users_id: userId },
      //       attributes: ['team_id'],
      //       as: "usersTeams",
      //       required: false, // Include tournaments even if the user isn't on a team
      //     },
      //   },
      // });
      const { count, rows: tournaments } = await Tournament.findAndCountAll({
        include: {
          model: Team,
          attributes: ["id"],
          include: {
            model: Users_Team,
            where: { users_id: userId },
            attributes: ["team_id"],
            as: "usersTeams",
            required: false,
          },
        },
        limit,
        offset,
      });

      // Construct the response
      const tournamentDetails = tournaments.map((tournament) => {
        const userTeam = (tournament.Teams || []).find(
          (team) => team.usersTeams && team.usersTeams.length > 0
        );

        return {
          id: tournament.id,
          name: tournament.name,
          description: tournament.description,
          enroll_startDate: tournament.enroll_startDate,
          enroll_endDate: tournament.enroll_endDate,
          event_startDate: tournament.event_startDate,
          event_endDate: tournament.event_endDate,
          createdAt: tournament.createdAt,
          updatedAt: tournament.updatedAt,
          hasJoined: !!userTeam, //not work
          teamId: userTeam ? userTeam.id : null,
          teamCount: tournament.Teams ? tournament.Teams.length : 0,
        };
      });

      const totalPages = Math.ceil(count / limit);
      const hasNextPage = parsedPage < totalPages;

      return h
        .response({
          currentPage: parsedPage,
          data: tournamentDetails,
          totalItems: count,
          totalPages: totalPages,
          hasNextPage: hasNextPage,
        })
        .code(200);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      return h
        .response({
          message: "Failed to get tournaments",
          error: error.message,
        })
        .code(500);
    }
  },

  getAvailableTournaments: async (req, h) => {
    try {
      const now = new Date();

      const tournaments = await Tournament.findAll({
        where: {
          enroll_endDate: {
            [Op.gt]: now, // Check if enroll_endDate is greater than current time
          },
        },
      });

      return h.response(tournaments).code(200);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      return h
        .response({
          message: "Failed to get tournaments",
          error: error.message,
        })
        .code(500);
    }
  },

  getTournamentDetails: async (req, h) => {
    try {
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      // Retrieve user
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { student_id: decoded.student_id },
            { itaccount: decoded.email },
          ],
        },
      });

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      // Use `user.id` for fetching details
      const userId = user.user_id;
      const id = req.params.tournament_id;

      // Find tournament details
      const tournament = await Tournament.findByPk(id);

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      // Individual score (example query from TournamentPoints)
      const individualScore = await TournamentPoints.sum("points", {
        where: { tournament_id: id, users_id: userId },
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

      // Find user's team_id in the specified tournament
      const userTeam = await Users_Team.findOne({
        where: { users_id: userId },
        include: {
          model: Team,
          where: { tournament_id: id },
          as: "team",
          attributes: ["id"], // Assuming id is the team_id
        },
      });

      if (!userTeam) {
        return h
          .response({
            message: "User is not part of any team in this tournament.",
          })
          .code(404);
      }
      // console.log(userTeam);

      const userTeamId = userTeam.team_id;
      // console.log(userTeamId);

      const rankedLeaderboard = teamScores.map((entry, index) => ({
        team_id: entry.team_id,
        team_name: entry.Team.name,
        total_points: entry.total_points,
        rank: index + 1,
      }));
      // console.log(rankedLeaderboard);

      const userTeamRank = rankedLeaderboard.find(
        (rank) => rank.team_id === userTeamId
      );

      return h
        .response({
          name: tournament.name,
          teamId: userTeamRank ? userTeamRank.team_id : null,
          teamName: userTeamRank ? userTeamRank.team_name : null,
          teamRank: userTeamRank ? userTeamRank.rank : null,
          teamScore: userTeamRank ? userTeamRank.total_points : null,
          individualScore: individualScore || 0,
          eventEndDate: tournament.event_endDate,
        })
        .code(200);
    } catch (error) {
      console.error("Error fetching tournament details:", error);
      return h
        .response({
          message: "Failed to get tournament details",
          error: error.message,
        })
        .code(500);
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

      return h
        .response({ message: "Tournament deleted successfully" })
        .code(200);
    } catch (error) {
      console.error("Error deleting tournament:", error);
      return h
        .response({
          message: "Failed to delete tournament",
          error: error.message,
        })
        .code(500);
    }
  },
};

module.exports = tournamentController;
