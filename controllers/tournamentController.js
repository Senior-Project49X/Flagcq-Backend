const db = require("../models");
const { Team, Users_Team, TeamScores, User, TournamentPoints, Tournament } = db;
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");

const tournamentController = {
  generatePrivateCode: () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let PrivateCode = "";
    for (let i = 0; i < 6; i++) {
      PrivateCode += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return PrivateCode;
  },

  createTournament: async (req, h) => {
    try {
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const {
        name,
        description,
        enroll_startDate,
        enroll_endDate,
        event_startDate,
        event_endDate,
        mode,
        teamSizeLimit, // 1-4
        limit, // playerLimit if teamSizeLimit is 1, otherwise teamLimit
      } = req.payload;

      const existingTournament = await Tournament.findOne({ where: { name } });
      if (existingTournament) {
        return h
          .response({
            message:
              "Tournament name already exists, Please change the tournament name.",
          })
          .code(400);
      }

      const enrollStart = moment
        .tz(enroll_startDate, "Asia/Bangkok")
        .utc()
        .toDate();
      const enrollEnd = moment
        .tz(enroll_endDate, "Asia/Bangkok")
        .utc()
        .toDate();
      const eventStart = moment
        .tz(event_startDate, "Asia/Bangkok")
        .utc()
        .toDate();
      const eventEnd = moment.tz(event_endDate, "Asia/Bangkok").utc().toDate();

      if (enrollStart >= enrollEnd) {
        return h
          .response({
            message: "Enrollment start date must be before enrollment end date",
          })
          .code(400);
      }

      if (enrollEnd >= eventEnd) {
        return h
          .response({
            message: "Enrollment end date must be before event end date",
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

      if (!teamSizeLimit || ![1, 2, 3, 4].includes(teamSizeLimit)) {
        return h
          .response({ message: "Team size limit must be 1 to 4" })
          .code(400);
      }

      const isUniqueCode = async (code) => {
        const existingCode = await Tournament.findOne({
          where: { joinCode: code },
        });
        return !existingCode;
      };

      // Generate join code only for private tournaments
      let joinCode = null;
      if (mode.toLowerCase() === "private") {
        joinCode = tournamentController.generatePrivateCode();
        while (!(await isUniqueCode(joinCode))) {
          joinCode = tournamentController.generatePrivateCode();
        }
      }

      const playerLimit = teamSizeLimit === 1 ? limit : teamSizeLimit * limit;
      const teamLimit = teamSizeLimit === 1 ? limit : limit;

      const newTournament = await Tournament.create({
        name,
        description,
        enroll_startDate: enrollStart,
        enroll_endDate: enrollEnd,
        event_startDate: eventStart,
        event_endDate: eventEnd,
        mode,
        teamSizeLimit,
        playerLimit,
        teamLimit,
        joinCode,
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

  editTournament: async (req, h) => {
    try {
      const {
        tournament_id,
        name,
        description,
        enroll_startDate,
        enroll_endDate,
        event_startDate,
        event_endDate,
        mode,
        teamSizeLimit,
        limit,
      } = req.payload;
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }
      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }
      if (user.role !== "Admin") {
        return h
          .response({ message: "Forbidden: Only admins can edit tournaments." })
          .code(403);
      }
      const tournament = await Tournament.findByPk(tournament_id);
      if (!tournament) {
        return h.response({ message: "Tournament not found." }).code(404);
      }
      
      // Convert dates to UTC+7
      const enrollStartDateUTC7 = moment
        .tz(enroll_startDate, "Asia/Bangkok")
        .utc()
        .toDate();
      const enrollEndDateUTC7 = moment
        .tz(enroll_endDate, "Asia/Bangkok")
        .utc()
        .toDate();
      const eventStartDateUTC7 = moment
        .tz(event_startDate, "Asia/Bangkok")
        .utc()
        .toDate();
      const eventEndDateUTC7 = moment
        .tz(event_endDate, "Asia/Bangkok")
        .utc()
        .toDate();
      
      // Check if current time has passed enrollment start date
      const currentTime = new Date();
      const enrollmentStarted = currentTime >= tournament.enroll_startDate;
      
      // If enrollment has started, prevent changing teamSizeLimit and limit
      if (enrollmentStarted && 
          (tournament.teamSizeLimit !== parseInt(teamSizeLimit) || 
           tournament.teamLimit !== parseInt(limit))) {
        return h
          .response({
            message: "Cannot change team size limit or team limit after enrollment has started",
          })
          .code(400);
      }
      
      if (enrollStartDateUTC7 >= enrollEndDateUTC7) {
        return h
          .response({
            message: "Enrollment start date must be before enrollment end date",
          })
          .code(400);
      }
      if (enrollEndDateUTC7 >= eventEndDateUTC7) {
        return h
          .response({
            message: "Enrollment end date must be before event end date",
          })
          .code(400);
      }
      if (eventStartDateUTC7 >= eventEndDateUTC7) {
        return h
          .response({
            message: "Event start date must be before event end date",
          })
          .code(400);
      }
      if (!teamSizeLimit || ![1, 2, 3, 4].includes(teamSizeLimit)) {
        return h
          .response({ message: "Team size limit must be 1 to 4" })
          .code(400);
      }
      
      const playerLimit = teamSizeLimit === 1 ? limit : teamSizeLimit * limit;
      const teamLimit = teamSizeLimit === 1 ? limit : limit;

      const isUniqueCode = async (code) => {
        const existingCode = await Tournament.findOne({
          where: { joinCode: code },
        });
        return !existingCode;
      };

      // Generate join code only for private tournaments
      let joinCode = null;
      if (mode.toLowerCase() === "private") {
        joinCode = tournamentController.generatePrivateCode();
        while (!(await isUniqueCode(joinCode))) {
          joinCode = tournamentController.generatePrivateCode();
        }
      }
      
      // Check if mode changed from public to private
      const updateData = {
        name,
        description,
        enroll_startDate: enrollStartDateUTC7,
        enroll_endDate: enrollEndDateUTC7,
        event_startDate: eventStartDateUTC7,
        event_endDate: eventEndDateUTC7,
        mode,
        teamSizeLimit,
        playerLimit,
        teamLimit,
      };
    
      // Generate new private code if changing from public to private
      if (tournament.mode.toLowerCase() === 'public' && mode.toLowerCase() === 'private') {
        updateData.joinCode = joinCode;
      }
      
      await tournament.update(updateData);
      
      return h
        .response({ 
          message: "Tournament updated successfully.",
          joinCode: updateData.joinCode || tournament.joinCode
        })
        .code(200);
    } catch (error) {
      console.error("Error updating tournament:", error);
      return h
        .response({
          message: "Failed to update tournament",
          error: error.message,
        })
        .code(500);
    }
  },

  getAllTournaments: async (req, h) => {
    try {
      const { page = 1 } = req.query;
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      const userId = user.user_id;
      const parsedPage = parseInt(page, 10);
      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 4;
      const offset = (parsedPage - 1) * limit;

      const { count, rows: tournaments } = await Tournament.findAndCountAll({
        include: {
          model: Team,
          attributes: ["id"],
          include: {
            model: Users_Team,
            as: "usersTeams",
            attributes: ["team_id"],
            where: { users_id: userId },
            required: false,
          },
        },
        distinct: true,
      });

      let tournamentDetails = tournaments.map((tournament) => {
        const userTeam = (tournament.Teams || []).find(
          (team) => team.usersTeams && team.usersTeams.length > 0
        );

        const isPrivate = tournament.mode.toLowerCase() === "private";

        return {
          id: tournament.id,
          name: tournament.name,
          description: tournament.description,
          enroll_startDate: tournament.enroll_startDate,
          enroll_endDate: tournament.enroll_endDate,
          event_startDate: tournament.event_startDate,
          event_endDate: tournament.event_endDate,
          mode: tournament.mode,
          teamLimit: tournament.teamLimit,
          playerLimit: tournament.playerLimit,
          createdAt: tournament.createdAt,
          updatedAt: tournament.updatedAt,
          hasJoined: !!userTeam,
          teamId: userTeam ? userTeam.team_id : null,
          teamCount: tournament.Teams ? tournament.Teams.length : 0,
          joinCode: isPrivate ? tournament.joinCode : null,
        };
      });

      // Filtering logic
      tournamentDetails = tournamentDetails
        .filter((tournament) => {
          const now = new Date();
          const hasUserJoinedOrAdmin =
            tournament.hasJoined || user.role === "Admin";
          const isEnrollmentOpen = new Date(tournament.enroll_endDate) > now;
          const isEventOngoing = new Date(tournament.event_endDate) > now;
          const isPrivate = tournament.mode.toLowerCase() === "private";

          // For private tournaments, only show if user has joined or is admin
          if (isPrivate && !hasUserJoinedOrAdmin) {
            return false;
          }

          // Show if user has joined, is admin, enrollment is open, or event is ongoing
          return hasUserJoinedOrAdmin || isEnrollmentOpen || isEventOngoing;
        })
        .sort((a, b) => {
          const now = new Date();

          const aOngoing = new Date(a.event_endDate) > now;
          const bOngoing = new Date(b.event_endDate) > now;

          const aCanEnroll = new Date(a.enroll_endDate) > now;
          const bCanEnroll = new Date(b.enroll_endDate) > now;

          // 1. Ongoing and Joined
          if (a.hasJoined && aOngoing && !(b.hasJoined && bOngoing)) return -1;
          if (b.hasJoined && bOngoing && !(a.hasJoined && aOngoing)) return 1;

          // 2. Not Joined but Can Enroll
          if (!a.hasJoined && aCanEnroll && !(b.hasJoined && bCanEnroll))
            return -1;
          if (!b.hasJoined && bCanEnroll && !(a.hasJoined && aCanEnroll))
            return 1;

          // 3. Ongoing and Not Joined
          if (!a.hasJoined && aOngoing && !(b.hasJoined && bOngoing)) return -1;
          if (!b.hasJoined && bOngoing && !(a.hasJoined && aOngoing)) return 1;

          // 4. Joined but Ended
          if (a.hasJoined && !aOngoing) return 1;
          if (b.hasJoined && !bOngoing) return -1;

          // Default: Sort by creation date, newest first
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

      const totalPages = Math.ceil(tournamentDetails.length / limit);
      const paginatedData = tournamentDetails.slice(offset, offset + limit);

      return h
        .response({
          currentPage: parsedPage,
          data: paginatedData,
          totalItems: tournamentDetails.length,
          totalPages: totalPages,
          hasNextPage: parsedPage < totalPages,
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

  getJoinedTournaments: async (req, h) => {
    try {
      const { page = 1 } = req.query;
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      const userId = user.user_id;
      const parsedPage = parseInt(page, 10);
      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 4;
      const offset = (parsedPage - 1) * limit;

      // First, get all tournament IDs that the user has joined
      const joinedTournamentIds = await Tournament.findAll({
        attributes: ["id"],
        include: {
          model: Team,
          attributes: [],
          include: {
            model: Users_Team,
            where: { users_id: userId },
            attributes: ["team_id"],
            as: "usersTeams",
            required: true,
          },
          required: true,
        },
        raw: true, //maybe the problem is here
      });

      const tournamentIds = joinedTournamentIds.map((t) => t.id);

      // Then, get the paginated tournaments with all teams included
      const { count, rows: tournaments } = await Tournament.findAndCountAll({
        where: {
          id: {
            [Op.in]: tournamentIds,
          },
        },
        include: [
          {
            model: Team,
            include: {
              model: Users_Team,
              where: { users_id: userId },
              attributes: ["team_id"],
              as: "usersTeams",
              required: false,
            },
          },
        ],
        limit,
        offset,
        order: [["createdAt", "DESC"]],
        distinct: true,
      });

      // Construct the response
      const tournamentDetails = tournaments.map((tournament) => {
        const userTeam = tournament.Teams.find(
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
          mode: tournament.mode,
          teamLimit: tournament.teamLimit,
          playerLimit: tournament.playerLimit,
          createdAt: tournament.createdAt,
          updatedAt: tournament.updatedAt,
          hasJoined: !!userTeam,
          teamId: userTeam ? userTeam.id : null,
          teamCount: tournament.Teams ? tournament.Teams.length : 0, // Now this will include all teams
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
          hasNextPage,
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

  getTournamentDetails: async (req, h) => {
    try {
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      // Use `user.id` for fetching details
      const userId = user.user_id;
      const id = req.params.tournament_id;

      // Find tournament details
      const tournament = await Tournament.findByPk(id, {
        attributes: {
          exclude: ["createdAt", "updatedAt"],
        },
      });

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      if (user.role === "Admin") {
        return h
          .response({
            event_startDate: tournament.event_startDate,
            event_endDate: tournament.event_endDate,
            enroll_endDate: tournament.enroll_endDate,
            enroll_startDate: tournament.enroll_startDate,
            name: tournament.name,
            mode: tournament.mode,
          })
          .code(200);
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
        attributes: ["team_id"],
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

      const userTeamId = userTeam.team_id;

      const rankedLeaderboard = teamScores.map((entry, index) => ({
        team_id: entry.team_id,
        team_name: entry.Team.name,
        total_points: entry.total_points,
        rank: index + 1,
      }));

      const userTeamRank = rankedLeaderboard.find(
        (rank) => rank.team_id === userTeamId
      );

      return h
        .response({
          joinCode: tournament.joinCode,
          name: tournament.name,
          teamId: userTeamRank ? userTeamRank.team_id : null,
          teamName: userTeamRank ? userTeamRank.team_name : null,
          teamRank: userTeamRank ? userTeamRank.rank : null,
          teamScore: userTeamRank ? userTeamRank.total_points : null,
          individualScore: individualScore || 0,
          event_endDate: tournament.event_endDate,
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
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      if (user.role !== "Admin") {
        return h
          .response({
            message: "Forbidden: Only admins can delete tournaments.",
          })
          .code(403);
      }

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

  getAllInfoInTournament: async (req, h) => {
    try {
      const { tournament_id } = req.params;

      if (!tournament_id) {
        return h.response({ message: "Tournament ID is required." }).code(400);
      }

      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      // Fetch the leaderboard to determine ranks
      const leaderboard = await TeamScores.findAll({
        where: { tournament_id }, // Filter by tournament_id
        attributes: ["team_id", "total_points"], // Fetch necessary fields
        order: [
          ["total_points", "DESC"], // Order by total points descending
          ["updatedAt", "ASC"], // Break ties using updatedAt (earliest first)
        ],
        include: [
          {
            model: Team, // Join with the Teams table
            attributes: ["id", "name"], // Fetch team names
            required: true,
          },
        ],
      });

      // Map team ID to their rank
      const rankMap = {};
      leaderboard.forEach((entry, index) => {
        rankMap[entry.team_id] = index + 1; // Assign rank starting from 1
      });

      // Fetch teams with their scores and members
      const teams = await Team.findAll({
        where: { tournament_id },
        attributes: ["id", "name"],
        subQuery: false,
        include: [
          {
            model: TeamScores,
            attributes: ["team_id", "total_points"],
            where: { tournament_id },
            required: true,
          },
          {
            model: Users_Team,
            as: "usersTeams",
            attributes: ["team_id", "users_id"],
            include: [
              {
                model: User,
                as: "user",
                attributes: ["user_id", "first_name", "last_name"],
                include: [
                  {
                    model: TournamentPoints,
                    as: "tournamentPoints",
                    where: { tournament_id },
                    attributes: ["points"],
                    required: false,
                    separate: true, // ✅ ดึง TournamentPoints แยกกันชัดเจน
                  },
                ],
              },
            ],
          },
        ],
      });

      // Map and structure the response
      const response = teams.map((team) => {
        // Assuming each team will have only one TeamScores record associated with it
        const totalPoints = team.TeamScores[0]?.total_points || 0;

        const members = team.usersTeams.map((member, index) => ({
          // userId: member.user.user_id,
          // isLeader: index === 0,
          firstName: member.user.first_name,
          lastName: member.user.last_name,
          individualScore: member.user.tournamentPoints?.[0]?.points || 0,
        }));

        return {
          teamID: team.id,
          teamName: team.name,
          totalPoints,
          rank: rankMap[team.id], // Get the rank from the rankMap
          members,
        };
      });

      // Sort the response by rank
      response.sort((a, b) => a.rank - b.rank);

      return h.response(response).code(200);
    } catch (error) {
      return h
        .response({
          message: "Failed to retrieve team information.",
          error: error.message,
        })
        .code(500);
    }
  },

  getMyTeamInfoInTournament: async (req, h) => {
    try {
      const { tournament_id } = req.params;
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h
          .response({ message: "Unauthorized: No token provided." })
          .code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      // Use `user.id` for fetching details
      const users_id = user.user_id;

      if (!tournament_id) {
        return h.response({ message: "Tournament ID is required." }).code(400);
      }

      // First find the user's team
      const userTeam = await Users_Team.findOne({
        where: { users_id },
        attributes: ["team_id"],
        include: [
          {
            model: Team,
            where: { tournament_id },
            as: "team",
            required: true,
          },
        ],
      });

      if (!userTeam) {
        return h
          .response({
            message: "User is not part of any team in this tournament.",
          })
          .code(404);
      }

      const team_id = userTeam.team_id;

      // Fetch the leaderboard to determine rank
      const leaderboard = await TeamScores.findAll({
        where: { tournament_id },
        attributes: ["team_id", "total_points"],
        order: [
          ["total_points", "DESC"],
          ["updatedAt", "ASC"],
        ],
        include: [
          {
            model: Team,
            attributes: ["id", "name"],
            required: true,
          },
        ],
      });

      // Find user's team rank
      const rank =
        leaderboard.findIndex((entry) => entry.team_id === team_id) + 1;

      // Fetch specific team with scores and members
      const team = await Team.findOne({
        where: {
          id: team_id,
          tournament_id,
        },
        attributes: ["id", "name"],
        include: [
          {
            model: TeamScores,
            attributes: ["team_id", "total_points"],
            where: { tournament_id },
            required: true,
          },
          {
            model: Users_Team,
            as: "usersTeams",
            attributes: ["users_id", "team_id"],
            include: [
              {
                model: User,
                as: "user",
                attributes: ["user_id", "first_name", "last_name"],
                include: [
                  {
                    model: TournamentPoints,
                    as: "tournamentPoints",
                    where: { tournament_id },
                    attributes: ["points"],
                    required: false,
                  },
                ],
              },
            ],
          },
        ],
      });

      if (!team) {
        return h.response({ message: "Team not found." }).code(404);
      }

      // Structure the response
      const totalPoints = team.TeamScores[0]?.total_points || 0;
      const members = team.usersTeams.map((member, index) => ({
        isLeader: index === 0,
        firstName: member.user.first_name,
        lastName: member.user.last_name,
        individualScore: member.user.tournamentPoints[0]?.points || 0,
      }));

      const response = {
        teamID: team.id,
        teamName: team.name,
        totalPoints,
        rank,
        members,
      };

      return h.response(response).code(200);
    } catch (error) {
      console.error("Error retrieving team information:", error.message);
      return h
        .response({
          message: "Failed to retrieve team information.",
          error: error.message,
        })
        .code(500);
    }
  },

  getTournamentById: async (req, h) => {
    try {
      const parsedId = parseInt(req.params.id, 10);
      if (isNaN(parsedId) || parsedId <= 0) {
        return h.response({ message: "Invalid tournament ID" }).code(400);
      }

      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h
          .response({
            message: "Forbidden: Only admins can edit tournaments.",
          })
          .code(403);
      }

      const tournament = await Tournament.findByPk(parsedId, {
        attributes: { exclude: ["createdAt", "updatedAt"] },
      });
      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      return h.response(tournament).code(200);
    } catch (error) {
      console.error("Error fetching tournament:", error);
      return h
        .response({
          message: "Failed to get tournament",
          error: error.message,
        })
        .code(500);
    }
  },

  getAllTournamentList: async (req, h) => {
    try {
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const tournaments = await Tournament.findAll({
        attributes: ["id", "name", "event_startDate", "event_endDate"],
        order: [["id", "DESC"]],
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
};

async function authenticateUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (err) {
    return null;
  }

  const user = await User.findOne({
    where: {
      itaccount: decoded.email,
    },
  });

  return user;
}

module.exports = tournamentController;
