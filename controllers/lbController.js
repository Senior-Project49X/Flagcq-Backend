"use strict";

const db = require("../models");
const User = db.User;
const Point = db.Point;

const lbController = {
  getLeaderboard: async (request, h) => {
    try {
      const leaderboard = await Point.findAll({
        attributes: ["users_id", "points"],
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
      console.log(error);

      return h.response({ message: "Failed to fetch leaderboard" }).code(500);
    }
  },
};

module.exports = lbController;
