const jwt = require("jsonwebtoken");
const db = require("../models");
const { Team, Users_Team, TeamScores, User, TournamentPoints, Tournament } = db;
const axios = require("axios");
const { Op } = require("sequelize");
const moment = require("moment-timezone");

const teamController = {
  // Helper function to generate a random invite code (8 characters)
  generateInviteCode: () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let inviteCode = "";
    for (let i = 0; i < 8; i++) {
      inviteCode += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }
    return inviteCode;
  },

  // Create Team function
  createTeam: async (req, h) => {
    try {
      const { name, tournament_id, join_code } = req.payload;

      if (!name || !tournament_id) {
        return h
          .response({ message: "Name and Tournament ID are required." })
          .code(400);
      }

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

      const user_id = user.user_id;

      // Check current time against tournament's enroll_endDate
      const currentTime = moment.tz("Asia/Bangkok");

      const tournament = await Tournament.findOne({
        where: { id: tournament_id },
      });

      if (!tournament) {
        return h.response({ message: "Tournament not found." }).code(404);
      }

      if (currentTime.isAfter(tournament.enroll_endDate)) {
        return h
          .response({ message: "Enrollment period has ended." })
          .code(400);
      }
      // console.log(currentTime);
      // console.log(tournament.enroll_endDate);

      // Check the mode of the tournament
      if (tournament.mode === "Private") {
        if (!join_code || join_code !== tournament.joinCode) {
          return h
            .response({
              message: "Invalid join code for the private tournament.",
            })
            .code(400);
        }
      }

      // Check the team limit
      const existingTeamCount = await Team.count({ where: { tournament_id } });
      if (existingTeamCount >= tournament.teamLimit) {
        return h
          .response({
            message: "The team limit for this tournament has been reached.",
          })
          .code(400);
      }

      const userAlreadyInTeam = await Users_Team.findOne({
        include: [
          {
            model: Team,
            as: "team",
            where: { tournament_id },
          },
        ],
        where: { users_id: user_id },
      });

      if (userAlreadyInTeam) {
        return h
          .response({
            message: "User is already in a team for this tournament.",
          })
          .code(400);
      }

      const existingTeam = await Team.findOne({
        where: { name, tournament_id },
      });

      if (existingTeam) {
        return h
          .response({
            message: "A team with this name already exists in the tournament.",
          })
          .code(400);
      }

      const newTeam = await Team.create({
        name,
        tournament_id,
        invite_code: teamController.generateInviteCode(),
      });

      await Users_Team.create({
        users_id: user_id,
        team_id: newTeam.id,
      });

      await TeamScores.create({
        team_id: newTeam.id,
        tournament_id,
        total_points: 0,
      });

      await TournamentPoints.create({
        users_id: user_id,
        tournament_id,
        points: 0,
      });

      return h
        .response({
          message: "Team created successfully",
          team: newTeam,
        })
        .code(201);
    } catch (error) {
      console.error("Error creating team:", error.message);
      return h
        .response({
          message: "Failed to create team",
          error: error.message,
        })
        .code(500);
    }
  },

  //
  createTeamMock: async (req, h) => {
    try {
      const { name, tournament_id, user_id } = req.payload;

      if (!name || !tournament_id || !user_id) {
        return h
          .response({
            message: "Name, Tournament ID, and User ID are required.",
          })
          .code(400);
      }

      // Retrieve the user directly by user_id (for testing purposes, bypass token verification)
      const user = await User.findOne({
        where: { user_id },
      });

      if (!user) {
        return h.response({ message: "User not found." }).code(404);
      }

      // Check if the user is already in a team for this tournament
      const userAlreadyInTeam = await Users_Team.findOne({
        include: [
          {
            model: Team,
            as: "team",
            where: { tournament_id },
          },
        ],
        where: { users_id: user_id },
      });

      if (userAlreadyInTeam) {
        return h
          .response({
            message: "User is already in a team for this tournament.",
          })
          .code(400);
      }

      // Check if a team with the same name already exists
      const existingTeam = await Team.findOne({
        where: { name, tournament_id },
      });

      if (existingTeam) {
        return h
          .response({
            message: "A team with this name already exists in the tournament.",
          })
          .code(400);
      }

      const tournament = await Tournament.findOne({
        where: { id: tournament_id },
      });

      if (!tournament) {
        return h.response({ message: "Tournament not found." }).code(404);
      }

      const existingTeamCount = await Team.count({ where: { tournament_id } });
      console.log(existingTeamCount);
      if (existingTeamCount >= tournament.teamLimit) {
        return h
          .response({
            message: "The team limit for this tournament has been reached.",
          })
          .code(400);
      }

      // Create the team
      const newTeam = await Team.create({
        name,
        tournament_id,
        invite_code: teamController.generateInviteCode(),
      });

      // Add the creator to the team in Users_Team
      await Users_Team.create({
        users_id: user_id,
        team_id: newTeam.id,
      });

      // Initialize the team score in TeamScores
      await TeamScores.create({
        team_id: newTeam.id,
        tournament_id,
        total_points: 0,
      });

      // Initialize individual score for the creator in TournamentPoints
      await TournamentPoints.create({
        users_id: user_id,
        tournament_id,
        points: 0, // Set points to 0
      });

      return h
        .response({
          message: "Team created successfully",
          team: newTeam,
        })
        .code(201);
    } catch (error) {
      console.error("Error creating team:", error.message);
      return h
        .response({
          message: "Failed to create team",
          error: error.message,
        })
        .code(500);
    }
  },

  // Join Team function
  joinTeam: async (req, h) => {
    try {
      const { invite_code, teamName } = req.payload;

      if (!invite_code) {
        return h.response({ message: "Invite code is required." }).code(400);
      }

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

      const user_id = user.user_id;
      let team;

      if (invite_code.length === 8) {
        // Public tournament: Join existing team
        team = await Team.findOne({ where: { invite_code } });

        if (!team) {
          return h
            .response({ message: "Team not found with that invite code." })
            .code(404);
        }
      } else if (invite_code.length === 6) {
        // Private tournament: Join with team creation
        if (!teamName) {
          return h
            .response({
              message: "Team name is required for private tournament joining.",
            })
            .code(400);
        }

        const privateTournament = await Tournament.findOne({
          where: { joinCode: invite_code, mode: "Private" },
        });

        if (!privateTournament) {
          return h
            .response({ message: "Invalid private tournament code." })
            .code(404);
        }

        const existingTeam = await Team.findOne({
          where: { name: teamName, tournament_id: privateTournament.id },
        });
        if (existingTeam) {
          return h
            .response({
              message:
                "A team with this name already exists in the tournament.",
            })
            .code(400);
        }

        team = await Team.create({
          name: teamName,
          tournament_id: privateTournament.id,
          invite_code: teamController.generateInviteCode(),
        });

        // Create the user-team relation for the newly created team
        await Users_Team.create({ users_id: user_id, team_id: team.id });

        // Initialize team scores and points
        await TeamScores.create({
          team_id: team.id,
          tournament_id: privateTournament.id,
          total_points: 0,
        });
        await TournamentPoints.create({
          users_id: user_id,
          tournament_id: privateTournament.id,
          points: 0,
        });

        return h
          .response({
            message:
              "Team created and joined successfully for private tournament",
            team,
          })
          .code(201);
      } else {
        return h.response({ message: "Invalid invite code format." }).code(400);
      }

      // Fetch the tournament details
      const tournament = await Tournament.findOne({
        where: { id: team.tournament_id },
      });
      const teamMembersCount = await Users_Team.count({
        where: { team_id: team.id },
      });

      const currentTime = moment.tz("Asia/Bangkok");
      if (currentTime.isAfter(tournament.enroll_endDate)) {
        return h
          .response({ message: "Enrollment period has ended." })
          .code(400);
      }

      const userAlreadyInTeam = await Users_Team.findOne({
        where: { users_id: user_id, team_id: team.id },
      });

      if (userAlreadyInTeam) {
        return h
          .response({
            message: "User is already in a team for this tournament.",
          })
          .code(400);
      }

      // Check if the team has reached the limit
      if (teamMembersCount >= tournament.teamSizeLimit) {
        return h
          .response({
            message:
              "This team is FULL. PLEASE CREATE A NEW TEAM OR JOIN ANOTHER TEAM.",
          })
          .code(400);
      }

      await Users_Team.create({ users_id: user_id, team_id: team.id });

      await TournamentPoints.create({
        users_id: user_id,
        tournament_id: team.tournament_id,
        points: 0,
      });

      return h
        .response({ message: "Successfully joined the team", team })
        .code(200);
    } catch (error) {
      console.error("Error joining team:", error.message);
      return h
        .response({ message: "Failed to join team", error: error.message })
        .code(500);
    }
  },

  // Join Team function (for testing with fake users_id)
  joinFakeTeam: async (req, h) => {
    try {
      const { invite_code, users_id } = req.payload; // Using fake users_id from the request

      if (!invite_code || !users_id) {
        return h
          .response({ message: "Invite code and users_id are required." })
          .code(400);
      }

      // Find the team by invite code
      const team = await Team.findOne({ where: { invite_code } });

      if (!team) {
        return h
          .response({ message: "Team not found with that invite code." })
          .code(404);
      }

      // Fetch the tournament details
      const tournament = await Tournament.findOne({
        where: { id: team.tournament_id },
      });
      const teamMembersCount = await Users_Team.count({
        where: { team_id: team.id },
      });

      const userAlreadyInTeam = await Users_Team.findOne({
        where: { users_id: users_id, team_id: team.id },
      });

      if (userAlreadyInTeam) {
        return h
          .response({
            message: "User is already in a team for this tournament.",
          })
          .code(400);
      }

      // Check if the team has reached the limit
      if (teamMembersCount >= tournament.teamSizeLimit) {
        return h
          .response({
            message: `Team is full. Limit is ${tournament.teamSizeLimit} members.`,
          })
          .code(400);
      }

      // Add the user to the team
      await Users_Team.create({
        users_id,
        team_id: team.id,
      });

      // Initialize the user's individual score in TournamentPoints
      await TournamentPoints.create({
        users_id,
        tournament_id: team.tournament_id,
        points: 0,
      });

      return h
        .response({
          message: "Successfully joined the team",
          team,
        })
        .code(200);
    } catch (error) {
      console.error("Error joining team:", error.message);
      return h
        .response({
          message: "Failed to join team",
          error: error.message,
        })
        .code(500);
    }
  },

  // Function to get the team members' scores
  getTeamScores: async (req, h) => {
    try {
      const { tournament_id, team_id } = req.params; // Extract parameters

      // Validate input
      if (!team_id || !tournament_id) {
        return h
          .response({ message: "Team ID and Tournament ID are required." })
          .code(400);
      }

      // Step 1: Get team score and team name
      const teamScore = await TeamScores.findOne({
        where: { team_id, tournament_id },
        attributes: ["team_id", "total_points"],
        include: [
          {
            model: Team, // Use the model directly without alias
            attributes: ["name"], // Fetch team name
          },
        ],
      });

      if (!teamScore) {
        return h
          .response({
            message: "Team score not found for the given tournament.",
          })
          .code(404);
      }

      // Step 2: Helper function to calculate rank
      const getTeamRank = async (tournament_id, team_id) => {
        try {
          // Retrieve all team scores and sort by total_points (descending)
          const allTeamScores = await TeamScores.findAll({
            where: { tournament_id },
            attributes: ["team_id", "total_points"],
            order: [
              ["total_points", "DESC"], // Sort by total points descending
              ["updatedAt", "ASC"], // If total_points are equal, sort by updatedAt ascending
            ],
          });

          // Find the rank of the specific team
          for (let index = 0; index < allTeamScores.length; index++) {
            const teamScore = allTeamScores[index];
            if (teamScore.team_id === parseInt(team_id)) {
              // Ensure team_id comparison works
              return index + 1; // Rank is index + 1
            }
          }

          return null; // Return null if the team is not found
        } catch (error) {
          console.error("Error calculating team rank:", error);
          throw error; // Propagate the error to the caller
        }
      };
      const rank = await getTeamRank(tournament_id, team_id);

      // Step 3: Fetch team members with their points (using Users_Team and TournamentPoints)
      const teamMembersScores = await Users_Team.findAll({
        where: { team_id },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["first_name", "last_name"],
            include: [
              {
                model: TournamentPoints,
                as: "tournamentPoints",
                where: { tournament_id },
                attributes: ["points"],
              },
            ],
          },
        ],
      });

      // Step 4: Format members with scores
      const membersWithScores = teamMembersScores.map((member) => ({
        first_name: member.user.first_name,
        last_name: member.user.last_name,
        points: member.user.tournamentPoints?.[0]?.points || 0,
      }));

      // Sort members by points (descending)
      const sortedMembers = membersWithScores.sort(
        (a, b) => b.points - a.points
      );

      // Step 5 Return result
      return h
        .response({
          message: "Team scores and rank retrieved successfully.",
          team_name: teamScore.Team.name, // Include team name
          total_score: teamScore.total_points,
          rank: rank,
          members: sortedMembers,
        })
        .code(200);
    } catch (error) {
      console.error("Error retrieving team scores:", error.message);
      return h
        .response({
          message: "Failed to retrieve team scores.",
          error: error.message,
        })
        .code(500);
    }
  },

  deleteTeam: async (req, h) => {
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
      // console.log(decoded);

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

      const userId = user.user_id; // Assuming this is set in the token
      const tournamentId = req.params.tournament_id;

      // Find user's team_id in the specified tournament
      const userTeam = await Users_Team.findOne({
        where: { users_id: userId },
        include: {
          model: Team,
          where: { tournament_id: tournamentId },
          as: "team",
          attributes: ["id"], // Assuming id is the team_id
        },
      });
      console.log(userTeam);

      if (!userTeam) {
        return h
          .response({
            message: "User is not part of any team in this tournament.",
          })
          .code(404);
      }

      const teamId = userTeam.team_id;
      console.log(teamId);

      // Find the leader of the team
      const leaderRecord = await Users_Team.findOne({
        where: { team_id: teamId },
        order: [["createdAt", "ASC"]], // Order by oldest record
      });

      if (!leaderRecord || leaderRecord.users_id !== userId) {
        return h
          .response({
            message: "Unauthorized: Only the team leader can delete the team.",
          })
          .code(403);
      }

      // Remove all users from the team
      await Users_Team.destroy({
        where: { team_id: teamId },
      });

      // Delete the team
      await Team.destroy({
        where: { id: teamId },
      });

      return h
        .response({
          message: "Team and its members have been successfully deleted.",
        })
        .code(200);
    } catch (error) {
      console.error("Error deleting team:", error);
      return h
        .response({
          message: "Failed to delete team",
          error: error.message,
        })
        .code(500);
    }
  },

  getTeamMemberPage: async (req, h) => {
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
      const tournamentId = req.params.tournament_id;
      const teamId = req.params.team_id;

      const userTeam = await Users_Team.findOne({
        where: { users_id: userId },
        include: {
          model: Team,
          where: { id: teamId, tournament_id: tournamentId },
          attributes: ["id", "name", "invite_code"],
          as: "team",
          include: {
            model: Tournament,
            attributes: ["name"],
          },
        },
      });

      if (!userTeam || !userTeam.team) {
        return h
          .response({
            message: "User is not part of any team in this tournament.",
          })
          .code(404);
      }

      const team = userTeam.team;
      // console.log(team);

      const teamMembers = await Users_Team.findAll({
        where: { team_id: teamId },
        include: {
          model: User,
          as: "user",
          attributes: ["user_id", "student_id", "first_name", "last_name"],
        },
        order: [["createdAt", "ASC"]],
      });

      const members = teamMembers.map((member) => ({
        userId: member.user.user_id,
        isLeader: member.createdAt === teamMembers[0].createdAt,
        student_id: member.user.student_id,
        first_name: member.user.first_name,
        last_name: member.user.last_name,
      }));

      const memberCount = teamMembers.length; // Count the number of team members
      const tournament = await Tournament.findOne({
        where: { id: tournamentId },
      });

      return h
        .response({
          tournamentName: team.Tournament.name,
          tournament_endDate: tournament.event_endDate,
          teamId: team.id,
          teamName: team.name,
          invitedCode: team.invite_code,
          memberCount,
          memberLimit: tournament.teamSizeLimit,
          members,
        })
        .code(200);
    } catch (error) {
      console.error("Error fetching team members:", error);
      return h
        .response({
          message: "Failed to get team members",
          error: error.message,
        })
        .code(500);
    }
  },

  kickTeamMember: async (req, h) => {
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
      const teamId = req.params.team_id;
      const memberIdToKick = req.params.member_id;

      // Check if the team exists
      const teamExists = await Team.findOne({
        where: { id: teamId },
      });

      if (!teamExists) {
        return h.response({ message: "Team not found." }).code(404);
      }

      // Check if the user is the leader of the team
      const leaderRecord = await Users_Team.findOne({
        where: { team_id: teamId },
        order: [["createdAt", "ASC"]],
      });

      if (!leaderRecord || leaderRecord.users_id !== userId) {
        return h
          .response({
            message: "Unauthorized: Only the team leader can kick members.",
          })
          .code(403);
      }

      // Ensure the member to kick is part of the team
      const memberRecord = await Users_Team.findOne({
        where: { team_id: teamId, users_id: memberIdToKick },
      });

      if (!memberRecord) {
        return h
          .response({
            message: "Member not found or is not part of the team.",
          })
          .code(404);
      }

      // Retrieve tournament_id using team_id
      const team = await Team.findOne({
        where: { id: teamId },
        attributes: ["tournament_id"],
      });

      if (!team) {
        return h.response({ message: "Team not found." }).code(404);
      }

      const tournamentId = team.tournament_id;

      // Kick the member from the team
      await Users_Team.destroy({
        where: { team_id: teamId, users_id: memberIdToKick },
      });

      // Remove user's tournament points
      await TournamentPoints.destroy({
        where: { tournament_id: tournamentId, users_id: memberIdToKick },
      });

      return h
        .response({ message: "Member successfully kicked from the team." })
        .code(200);
    } catch (error) {
      console.error("Error kicking team member:", error);
      return h
        .response({
          message: "Failed to kick team member",
          error: error.message,
        })
        .code(500);
    }
  },

  leaveTeam: async (req, h) => {
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

      // Find the user initiating the leave
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
      // const userId = "c08006fd-cb36-425c-8bc0-56d5e3a2b5d7";
      const teamId = req.params.team_id;

      // Retrieve tournament_id using team_id
      const team = await Team.findOne({
        where: { id: teamId },
        attributes: ["tournament_id"],
      });

      if (!team) {
        return h.response({ message: "Team not found." }).code(404);
      }

      const tournamentId = team.tournament_id;

      // Check if the user is part of the team
      const memberRecord = await Users_Team.findOne({
        where: { team_id: teamId, users_id: userId },
      });

      if (!memberRecord) {
        return h
          .response({
            message: "You are not a member of this team.",
          })
          .code(403);
      }

      // Check if the user is the leader of the team
      const leaderRecord = await Users_Team.findOne({
        where: { team_id: teamId },
        order: [["createdAt", "ASC"]],
      });

      if (leaderRecord && leaderRecord.users_id === userId) {
        return h
          .response({
            message:
              "Unauthorized: Team leaders cannot leave their own team. Assign a new leader first.",
          })
          .code(403);
      }

      // Remove user from Users_Team
      await Users_Team.destroy({
        where: { team_id: teamId, users_id: userId },
      });

      // Remove user's tournament points
      await TournamentPoints.destroy({
        where: { tournament_id: tournamentId, users_id: userId },
      });

      return h.response({ message: "Successfully left the team." }).code(200);
    } catch (error) {
      console.error("Error leaving team:", error);
      return h
        .response({
          message: "Failed to leave team",
          error: error.message,
        })
        .code(500);
    }
  },
};

module.exports = teamController;
