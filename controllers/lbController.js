"use strict";

const db = require("../models");
const User = db.User;
const Point = db.Point;
const jwt = require("jsonwebtoken");

const lbController = {
  // Leaderboard for practice mode
  getPracticeLeaderboard: async (request, h) => {
    try {
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ error: "User not found" }).code(404);
      }

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
module.exports = lbController;
