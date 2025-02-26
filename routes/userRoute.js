"use strict";

const path = require("path");
const usersController = require("../controllers/usersController");

const userRoute = [
  {
    method: "POST",
    path: "/api/login",
    handler: usersController.EntraLogin,
  },
  {
    method: "POST",
    path: "/api/logout",
    handler: usersController.EntraLogout,
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
    method: "POST",
    path: "/api/user/role",
    handler: usersController.addRole,
  },
];

module.exports = userRoute;
