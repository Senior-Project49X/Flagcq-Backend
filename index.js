"use strict";

const Hapi = require("@hapi/hapi");
const db = require("./models");
const sequelize = db.sequelize;
const Hello = require("./routes/hello");
const categoryRoute = require("./routes/catagoryRoutes");
const userRoute = require("./routes/userRoute");


const init = async () => {
  const server = Hapi.server({
    port: 3000,
    host: "0.0.0.0",
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

  server.ext("onPreResponse", (request, h) => {
    const response = request.response;
    if (!response.isBoom && response.header) {
      response.header(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';"
      );
    }
    return h.continue;
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
