const db = require("../models");
const Team = db.Team;
const Users_Team = db.Users_Team;
const User = db.User;

// Helper function to generate a random invite code (8 characters)
const generateInviteCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let inviteCode = "";
  for (let i = 0; i < 8; i++) {
    inviteCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return inviteCode;
};

// Create Team function
exports.createTeam = async (req, h) => {
    try {
      // Check if the necessary data is present in the request body
      const { name, tournament_id } = req.payload; // req.payload in Hapi.js
  
      if (!name || !tournament_id) {
        return h.response({ message: "Name and Tournament ID are required." }).code(400);
      }

      // Check if a team with the same name already exists in the same tournament
      const existingTeam = await db.Team.findOne({
        where: {
          name,
          tournament_id,
        },
      });

      if (existingTeam) {
        return h.response({ message: "A team with this name already exists in the tournament." }).code(400);
      }
  
      // Create the team using the data from the request
      const team = await db.Team.create({
        name,
        tournament_id,
        invite_code: generateInviteCode(), // Assuming you have a function for generating invite codes
      });
  
      return h.response(team).code(201); // Return the newly created team
    } catch (error) {
      console.error("Error creating team:", error);
      return h.response({ message: "Error creating team" }).code(500);
    }
  };
  

  exports.joinTeam = async (req, h) => {
    try {
      const { invite_code, user_id } = req.payload; // Use req.payload in Hapi.js
  
      // Find the team by invite code
      const team = await db.Team.findOne({ where: { invite_code } });
  
      if (!team) {
        return h.response({ error: "Team not found with that invite code" }).code(404);
      }
  
      // Check if the user is already in the team
      const existingUserTeam = await db.Users_Team.findOne({
        where: { users_id: user_id, team_id: team.id },
      });
  
      if (existingUserTeam) {
        return h.response({ error: "User already joined this team" }).code(400);
      }
  
      // Add the user to the team
      await db.Users_Team.create({
        users_id: user_id,
        team_id: team.id,
      });
  
      return h.response({
        message: "Successfully joined the team",
        team,
      }).code(200);
    } catch (err) {
      console.error("Error joining team:", err);
      return h.response({ error: "Failed to join team" }).code(500);
    }
  };
  
