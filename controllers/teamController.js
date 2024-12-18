const jwt = require("jsonwebtoken");
const db = require("../models");
const { Team, Users_Team, TeamScores, User, TournamentPoints } = db;
const axios = require("axios");
const { Op } = require("sequelize");

const teamController = {
  // Helper function to generate a random invite code (8 characters)
  generateInviteCode: () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let inviteCode = "";
    for (let i = 0; i < 8; i++) {
      inviteCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return inviteCode;
  },

  // Create Team function
  createTeam: async (req, h) => {
    try {
      const { name, tournament_id } = req.payload;
  
      if (!name || !tournament_id) {
        return h.response({ message: "Name and Tournament ID are required." }).code(400);
      }
  
      // Retrieve and verify the token from the cookie
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized: No token provided." }).code(401);
      }
  
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Unauthorized: Invalid token." }).code(401);
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
  
      const user_id = user.user_id;
  
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
        return h.response({ message: "User is already in a team for this tournament." }).code(400);
      }
  
      // Check if a team with the same name already exists
      const existingTeam = await Team.findOne({
        where: { name, tournament_id },
      });
  
      if (existingTeam) {
        return h.response({ message: "A team with this name already exists in the tournament." }).code(400);
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
      // No need to provide 'id' field; it will be auto-generated
      await TournamentPoints.create({
        users_id: user_id,
        tournament_id,
        points: 0, // Set points to 0
      });
  
      return h.response({
        message: "Team created successfully",
        team: newTeam,
      }).code(201);
    } catch (error) {
      console.error("Error creating team:", error.message);
      return h.response({
        message: "Failed to create team",
        error: error.message,
      }).code(500);
    }
  },  
  
  // Join Team function
  joinTeam: async (req, h) => {
    try {
      const { invite_code } = req.payload;

      if (!invite_code) {
        return h.response({ message: "Invite code is required." }).code(400);
      }

      // Retrieve and verify the token from the cookie
      const token = req.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized: No token provided." }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Unauthorized: Invalid token." }).code(401);
      }

      // Retrieve user using decoded data
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

      // Find the team by invite code
      const team = await Team.findOne({ where: { invite_code } });

      if (!team) {
        return h.response({ message: "Team not found with that invite code." }).code(404);
      }

      // Check if the team already has 4 members
      const teamMembersCount = await Users_Team.count({
        where: { team_id: team.id },
      });

      if (teamMembersCount >= 4) {
        return h.response({ message: "Team already has 4 members. Cannot join." }).code(400);
      }

      // Check if the user is already in the team using the alias "team"
      const userAlreadyInTeam = await Users_Team.findOne({
        where: { users_id: user_id, team_id: team.id },
        include: [
          {
            model: Team,
            as: "team", // Use the alias defined in Users_Team model
            attributes: [], // Optional: Exclude Team attributes if not needed
          },
        ],
      });

      if (userAlreadyInTeam) {
        return h.response({ message: "User is already in a team for this tournament." }).code(400);
      }

      // Add the user to the team
      await Users_Team.create({
        users_id: user_id,
        team_id: team.id,
      });

      // Initialize the user's individual score in TournamentPoints
      await TournamentPoints.create({
        users_id: user_id,
        tournament_id: team.tournament_id,
        points: 0,
      });

      return h.response({
        message: "Successfully joined the team",
        team,
      }).code(200);
      } catch (error) {
        console.error("Error joining team:", error.message);
        return h.response({
          message: "Failed to join team",
          error: error.message,
        }).code(500);
      }
    },
    
  // Join Team function (for testing with fake users_id)
  joinFakeTeam: async (req, h) => {
    try {
      const { invite_code, users_id } = req.payload; // Using fake users_id from the request

      if (!invite_code || !users_id) {
        return h.response({ message: "Invite code and users_id are required." }).code(400);
      }

      // Find the team by invite code
      const team = await Team.findOne({ where: { invite_code } });

      if (!team) {
        return h.response({ message: "Team not found with that invite code." }).code(404);
      }
      
      // Check if the team already has 4 members
      const teamMembersCount = await Users_Team.count({
        where: { team_id: team.id },
      });

      if (teamMembersCount >= 4) {
        return h.response({ message: "Team already has 4 members. Cannot join." }).code(400);
      }

      // Check if the user is already in the team using the alias "team"
      const userAlreadyInTeam = await Users_Team.findOne({
        where: { users_id: users_id, team_id: team.id },
        include: [
          {
            model: Team,
            as: "team", // Use the alias defined in Users_Team model
            attributes: [], // Optional: Exclude Team attributes if not needed
          },
        ],
      });

      if (userAlreadyInTeam) {
        return h.response({ message: "User is already in a team for this tournament." }).code(400);
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

      return h.response({
        message: "Successfully joined the team",
        team,
      }).code(200);
      } catch (error) {
        console.error("Error joining team:", error.message);
        return h.response({
          message: "Failed to join team",
          error: error.message,
        }).code(500);
      }
    },

  // Function to get the team members' scores
  getTeamScores: async (req, h) => {
    try {
      const { tournament_id, team_id } = req.params; // Extract parameters
  
      // Validate input
      if (!team_id || !tournament_id) {
        return h.response({ message: "Team ID and Tournament ID are required." }).code(400);
      }
  
      // Step 1: Get team score for the specific team
      const teamScore = await TeamScores.findOne({
        where: { team_id, tournament_id },
        attributes: ["team_id", "total_points"],
      });
  
      if (!teamScore) {
        return h.response({ message: "Team score not found for the given tournament." }).code(404);
      }
  
      // Step 2: Retrieve all scores for the tournament and sort by total_points (descending)
      const allTeamScores = await TeamScores.findAll({
        where: { tournament_id },
        attributes: ["team_id", "total_points"],
        order: [["total_points", "DESC"]], // Sort total_points in descending order
      });
  
      // Step 3: Find the rank of the specific team
      let rank = 1; // Start from 1
      for (const [index, team] of allTeamScores.entries()) {
        if (team.team_id === team_id) {
          rank = index + 1; // Rank is index + 1
          break;
        }
      }
  
      // Step 4: Fetch team members with their points (using Users_Team and TournamentPoints)
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
  
      // Step 5: Format members with scores
      const membersWithScores = teamMembersScores.map((member) => ({
        first_name: member.user.first_name,
        last_name: member.user.last_name,
        points: member.user.tournamentPoints?.[0]?.points || 0,
      }));
  
      // Sort members by points (descending)
      const sortedMembers = membersWithScores.sort((a, b) => b.points - a.points);
  
      // Step 6: Return result
      return h.response({
        message: "Team scores and rank retrieved successfully.",
        team_id,
        total_score: teamScore.total_points,
        rank: rank,
        members: sortedMembers,
      }).code(200);
    } catch (error) {
      console.error("Error retrieving team scores:", error.message);
      return h.response({
        message: "Failed to retrieve team scores.",
        error: error.message,
      }).code(500);
    }
  },  
      

};

module.exports = teamController;
