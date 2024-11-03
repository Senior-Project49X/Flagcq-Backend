"use strict";

const db = require("../models");
const sequelize = db.sequelize;
const jwt = require("jsonwebtoken");
const axios = require("axios");
const User = db.User;

const usersController = {
  oauthLogin: async (request, h) => {
    try {
      const { authorizationCode } = request.payload;
      if (!authorizationCode) {
        return h.response({ message: "Missing authorization code" }).code(400);
      }

      const accessToken = await getAccessToken(authorizationCode);
      if (!accessToken) {
        return h.response({ message: "Invalid authorization code" }).code(400);
      }

      const userInfo = await getUserInfo(accessToken);
      if (!userInfo) {
        return h.response({ message: "Invalid access token" }).code(400);
      }

      let user = await User.findOne({
        where: {
          student_id: userInfo.student_id || null,
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
        });
      }

      const token = jwt.sign(
        {
          first_name: user.first_name,
          last_name: user.last_name,
          AccType: user.AccType,
          faculty: user.faculty,
          student_id: user.student_id,
        },
        process.env.JWT_SECRET_KEY,
        { expiresIn: "1h" }
      );

      h.state("cmu-oauth-token", token, {
        ttl: 3600 * 1000,
        isSecure: process.env.NODE_ENV === "production",
        isHttpOnly: true,
        path: "/",
        samesite: "Lax",
      });

      return h.response({ message: "Login successful", token }).code(200);
    } catch (err) {
      console.error(err);
      return h.response({ error: "Login failed" }).code(500);
    }
  },

  oauthLogout: async (request, h) => {
    const token = request.state["cmu-oauth-token"];
    if (!token) {
      return h.response({ message: "Unauthorized" }).code(401);
    }

    h.unstate("cmu-oauth-token");
    return h.redirect("/?message=Logout successful").code(200);
  },
  getUser: async (request, h) => {
    const token = request.state["cmu-oauth-token"];
    if (!token) {
      return h.response({ message: "Unauthorized" }).code(401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    return h
      .response({
        first_name: decoded.first_name,
        last_name: decoded.last_name,
        AccType: decoded.AccType,
        faculty: decoded.faculty,
        student_id: decoded.student_id,
      })
      .code(200);
  },
};

async function getAccessToken(authorizationCode) {
  try {
    const response = await axios.post(
      process.env.CMU_OAUTH_GET_TOKEN_URL,
      {},
      {
        params: {
          code: authorizationCode,
          redirect_uri: process.env.CMU_OAUTH_REDIRECT_URL,
          client_id: process.env.CMU_OAUTH_CLIENT_ID,
          client_secret: process.env.CMU_OAUTH_CLIENT_SECRET,
          grant_type: "authorization_code",
        },
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
    const response = await axios.get(process.env.CMU_OAUTH_GET_BASIC_INFO, {
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
