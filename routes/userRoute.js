"use strict";

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
    handler: usersController.UserInfo,
  },
];

module.exports = userRoute;
