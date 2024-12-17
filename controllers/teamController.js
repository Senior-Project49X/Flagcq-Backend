const jwt = require("jsonwebtoken");
const db = require("../models");
const { Team, Users_Team, TeamScores, User } = db;
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
      // console.log("this is the token: " + token);
  
      // Verify JWT
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
  
      // Check if a team with the same name already exists in the same tournament
      const existingTeam = await Team.findOne({
        where: { name, tournament_id },
      });
  
      if (existingTeam) {
        return h.response({ message: "A team with this name already exists in the tournament." }).code(400);
      }
  
      // Create the team in the database
      const newTeam = await Team.create({
        name,
        tournament_id,
        invite_code: teamController.generateInviteCode(),
      });
  
      // Add an entry to users_team for the creator of the team
      await Users_Team.create({
        users_id: user_id,
        team_id: newTeam.id,
      });
  
      // Add an entry to teamscores with initial total_points = 0
      await TeamScores.create({
        team_id: newTeam.id,
        tournament_id,
        total_points: 0,
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

      // Get user_id from the token
      const user_id = teamController.getUserIdFromToken(req);

      // Find the team by invite code
      const team = await Team.findOne({ where: { invite_code } });

      if (!team) {
        return h.response({ message: "Team not found with that invite code." }).code(404);
      }

      // Check if the user is already in the team
      const existingUserTeam = await Users_Team.findOne({
        where: { users_id: user_id, team_id: team.id },
      });

      if (existingUserTeam) {
        return h.response({ message: "User already joined this team." }).code(400);
      }

      // Add the user to the team
      await Users_Team.create({
        users_id: user_id,
        team_id: team.id,
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
};

module.exports = teamController;
