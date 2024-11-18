"use strict";

const Hapi = require("@hapi/hapi");
const db = require("./models");
const sequelize = db.sequelize;
const Hello = require("./routes/hello");
const categoryRoute = require("./routes/catagoryRoutes");
const userRoute = require("./routes/userRoute");
const questionRoute = require("./routes/questionRoutes");

const init = async () => {
  const server = Hapi.server({
    port: 3001,
    host: "localhost",
    routes: {
      cors: {
        origin: ["http://localhost:3000"],
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
        exposedHeaders: ["X-Custom-Header"],
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
    console.log("Connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }

  await sequelize.sync({ alter: true });

  Hello(server);
  server.route(categoryRoute);
  server.route(userRoute);
  server.route(questionRoute);

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

init();
