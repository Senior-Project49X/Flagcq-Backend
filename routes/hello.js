const Hello = (server) => {
  server.route({
    method: "GET",
    path: "/",
    handler: (request, h) => {
      return "Hello, world!";
    },
  });
};

module.exports = Hello;