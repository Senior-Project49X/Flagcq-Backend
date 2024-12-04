"use strict";

const path = require("path");
const usersController = require("../controllers/usersController");

const userRoute = [
  {
    method: "POST",
    path: "/api/oauth-login",
    handler: usersController.oauthLogin,
  },
  {
    method: "POST",
    path: "/api/oauth-logout",
    handler: usersController.oauthLogout,
  },
  {
    method: "GET",
    path: "/api/users",
    handler: usersController.getUserPractice,
  },
  {
    method: "GET",
    path: "/api/token",
    handler: usersController.testToken,
  },
];

module.exports = userRoute;
