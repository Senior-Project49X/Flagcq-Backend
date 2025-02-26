"use strict";

require("dotenv").config();
const Hapi = require("@hapi/hapi");
const db = require("./models");
const sequelize = db.sequelize;
const categoryRoute = require("./routes/categoryRoutes");
const userRoute = require("./routes/userRoute");
const questionRoute = require("./routes/questionRoutes");
const teamRoute = require("./routes/teamRoutes");
const Inert = require("@hapi/inert");
const lbRoute = require("./routes/lbRoute");
const tournamentRoutes = require("./routes/tournamentRoutes");

const init = async () => {
  const server = Hapi.server({
    port: process.env.SERVER_PORT || 3001,
    host: process.env.SERVER_HOST || "localhost",
    routes: {
      cors: {
        origin: process.env.ALLOWED_ORIGINS
          ? process.env.ALLOWED_ORIGINS.split(",")
          : ["http://localhost:3000"],
        headers: [
          "Accept",
          "Authorization",
          "Content-Type",
          "If-None-Match",
          "X-Requested-With",
        ],
        additionalHeaders: ["X-Requested-With"],
        credentials: true,
        maxAge: 600,
        exposedHeaders: [
          "X-Custom-Header",
          "Content-Disposition",
          "Content-Length",
          "Content-Type",
        ],
      },
    },
  });

  server.route({
    method: "OPTIONS",
    path: "/{any*}",
    handler: (request, h) => {
      const response = h.response();
      response.header(
        "Access-Control-Allow-Headers",
        "Accept, Authorization, Content-Type, If-None-Match, X-Requested-With"
      );
      response.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      return response.code(204);
    },
    options: {
      auth: false,
      cors: true,
    },
  });

  try {
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return;
  }

  await server.register(Inert);
  console.log("✅ Inert plugin registered successfully");

  server.route(categoryRoute);
  server.route(userRoute);
  server.route(questionRoute);
  server.route(teamRoute);
  server.route(lbRoute);
  server.route(tournamentRoutes);

  await server.start();
  console.log("🚀 Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("🔥 Uncaught Exception:", err);
});

init();
