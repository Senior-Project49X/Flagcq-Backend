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
    path: "/api/user",
    handler: usersController.getUserPractice,
  },
  {
    method: "POST",
    path: "/api/token",
    handler: usersController.testToken,
  },
  {
    method: "GET",
    path: "/api/users",
    handler: usersController.getAllUsers,
  },
];

module.exports = userRoute;
