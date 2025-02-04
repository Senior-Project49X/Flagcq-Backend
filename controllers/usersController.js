"use strict";

const db = require("../models");
const sequelize = db.sequelize;
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = db.User;
const Point = db.Point;

const usersController = {
  EntraLogin: async (request, h) => {
    try {
      const { authorizationCode } = request.payload;
      if (!authorizationCode) {
        return h.response({ message: "Missing authorization code" }).code(400);
      }

      const accessToken = await getAccessToken(authorizationCode);
      if (!accessToken) {
        return h
          .response({ message: "Cannot get EntraID access token" })
          .code(400);
      }

      const userInfo = await getUserInfo(accessToken);
      if (!userInfo) {
        return h.response({ message: "Cannot get cmu basic info" }).code(400);
      }

      let user = await User.findOne({
        where: {
          itaccount: userInfo.cmuitaccount,
        },
      });

      if (!user) {
        user = await User.create({
          user_id: sequelize.fn("uuid_generate_v4"),
          student_id: userInfo.student_id || null,
          itaccount: userInfo.cmuitaccount,
          first_name: userInfo.firstname_EN,
          last_name: userInfo.lastname_EN,
          faculty: userInfo.organization_name_EN,
          AccType: userInfo.itaccounttype_id,
          role: "User",
        });
      }

      let point = await Point.findOne({
        where: {
          users_id: user.user_id,
        },
      });

      if (!point) {
        point = await Point.create({
          users_id: user.user_id,
          points: 0,
        });
      }

      const token = jwt.sign(
        {
          first_name: user.first_name,
          last_name: user.last_name,
          AccType: user.AccType,
          faculty: user.faculty,
          student_id: user.student_id,
          email: user.itaccount,
          point: point.points,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1d" }
      );

      h.state("cmu-oauth-token", token, {
        ttl: 3600 * 1000,
        isSecure: process.env.NODE_ENV === "production",
        isHttpOnly: true,
        path: "/",
        samesite: "Lax",
        domain: "localhost",
      });

      return h.response({ message: "Login successful", token }).code(200);
    } catch (err) {
      console.error(err);
      return h.response({ error: "Login failed" }).code(500);
    }
  },
  EntraLogout: async (request, h) => {
    try {
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      h.unstate("cmu-oauth-token");
      return h.redirect("/?message=Logout successful").code(200);
    } catch (err) {
      console.error(err);
      return h.response({ error: "Logout failed" }).code(500);
    }
  },
  getAllUsers: async (request, h) => {
    try {
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (user.role !== "Admin") {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const allUsers = await User.findAll({
        attributes: [
          "first_name",
          "last_name",
          "faculty",
          "student_id",
          "itaccount",
          "role",
        ],
      });

      return h.response(allUsers).code(200);
    } catch (err) {
      console.error(err);
      if (err.name === "TokenExpiredError") {
        return h.response({ message: "Token expired" }).code(401);
      } else if (err.name === "JsonWebTokenError") {
        return h.response({ message: "Invalid token" }).code(401);
      }
      return h.response({ error: "Get all users failed" }).code(500);
    }
  },
  getUserPractice: async (request, h) => {
    try {
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      const point = await Point.findOne({
        where: { users_id: user.user_id },
      });

      if (!point) {
        return h.response({ message: "Points not found" }).code(404);
      }

      const allPoints = await Point.findAll({
        attributes: ["users_id", "points"],
        order: [
          ["points", "DESC"],
          ["updatedAt", "ASC"],
        ],
      });

      const rank = allPoints.findIndex((p) => p.users_id === user.user_id) + 1;

      return h
        .response({
          first_name: decoded.first_name,
          last_name: decoded.last_name,
          AccType: decoded.AccType,
          faculty: decoded.faculty,
          student_id: decoded.student_id,
          email: decoded.email,
          points: point.points,
          rank: rank,
        })
        .code(200);
    } catch (err) {
      console.error(err);
      if (err.name === "TokenExpiredError") {
        return h.response({ message: "Token expired" }).code(401);
      } else if (err.name === "JsonWebTokenError") {
        return h.response({ message: "Invalid token" }).code(401);
      }
      return h.response({ error: "Get user failed" }).code(500);
    }
  },
  // getUserTournament: async (request, h) => {
  //   try {
  //     const token = request.state["cmu-oauth-token"];
  //     if (!token) {
  //       return h.response({ message: "Unauthorized" }).code(401);
  //     }

  //     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  //     if (!decoded) {
  //       return h.response({ message: "Invalid token" }).code(401);
  //     }

  //     const user = await User.findOne({
  //       where: { student_id: decoded.student_id },
  //     });

  //     const point = await Point.findOne({
  //       where: { users_id: user.user_id },
  //     });

  //     if (!point) {
  //       return h.response({ message: "Points not found" }).code(404);
  //     }

  //     return h
  //       .response({
  //         first_name: decoded.first_name,
  //         last_name: decoded.last_name,
  //         AccType: decoded.AccType,
  //         faculty: decoded.faculty,
  //         student_id: decoded.student_id,
  //         points: point.points,
  //       })
  //       .code(200);
  //   } catch (err) {
  //     console.error(err);
  //     if (err.name === "TokenExpiredError") {
  //       return h.response({ message: "Token expired" }).code(401);
  //     } else if (err.name === "JsonWebTokenError") {
  //       return h.response({ message: "Invalid token" }).code(401);
  //     }
  //     return h.response({ error: "Get user failed" }).code(500);
  //   }
  // },
  testToken: async (request, h) => {
    try {
      const { token } = request.payload;
      if (!token) {
        return h.response({ message: "Missing token" }).code(400);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      return h.response({ ok: true, role: user.role }).code(200);
    } catch (err) {
      console.error(err);
      if (err.name === "TokenExpiredError") {
        return h.response({ message: "Token expired" }).code(401);
      } else if (err.name === "JsonWebTokenError") {
        return h.response({ message: "Invalid token" }).code(401);
      }
      return h.response({ error: "Test token failed" }).code(500);
    }
  },
  addRole: async (request, h) => {
    try {
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      let user = await User.findOne({
        where: { itaccount: decoded.email },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const { users } = request.payload;
      let ArrayUsers = [];
      try {
        ArrayUsers = JSON.parse(users);
        if (ArrayUsers.length === 0) {
          return h.response({ message: "Empty array received" }).code(200);
        }

        if (
          Array.isArray(nestedArrayUsers) &&
          Array.isArray(nestedArrayUsers[0])
        ) {
          return h.response({ message: "Invalid Users format" }).code(400);
        }
      } catch (err) {
        return h.response({ message: "Invalid Users format" }).code(400);
      }

      return h.response({ message: "Add admin successful" }).code(200);
    } catch (err) {
      console.error(err);
      return h.response({ error: "Add admin failed" }).code(500);
    }
  },
};

async function getAccessToken(authorizationCode) {
  try {
    const response = await axios.post(
      process.env.CMU_ENTRAID_GET_TOKEN_URL,

      {
        code: authorizationCode,
        redirect_uri: process.env.CMU_ENTRAID_REDIRECT_URL,
        client_id: process.env.CMU_ENTRAID_CLIENT_ID,
        client_secret: process.env.CMU_ENTRAID_CLIENT_SECRET,
        scope: process.env.SCOPE,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function getUserInfo(accessToken) {
  try {
    const response = await axios.get(process.env.CMU_ENTRAID_GET_BASIC_INFO, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
    return null;
  }
}

module.exports = usersController;
