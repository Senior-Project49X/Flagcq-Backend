const db = require("../models");
const Mode = db.Mode;

const modesController = {
  getAllModes: async (request, h) => {
    try {
      const modes = await Mode.findAll();
      return h.response(modes).code(200);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve modes" }).code(500);
    }
  },
  createMode: async (request, h) => {
    try {
      const { name } = request.payload;

      if (!name || name.trim() === "") {
        return h.response({ error: "Mode name is required" }).code(400);
      }

      const newMode = await Mode.create({ name });
      return h.response(newMode).code(201);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to create mode" }).code(500);
    }
  },
  deleteMode: async (request, h) => {
    try {
      const mode = await Mode.findByPk(request.params.id);
      if (mode) {
        await mode.destroy();
        return h.response().code(204);
      }
      return h.response({ error: "Mode not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to delete mode" }).code(500);
    }
  },
  getModeById: async (request, h) => {
    try {
      const mode = await Mode.findByPk(request.params.id);
      if (mode) {
        return h.response(mode).code(200);
      }
      return h.response({ error: "Mode not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve mode" }).code(500);
    }
  },
  getModeByName: async (request, h) => {
    try {
      const mode = await Mode.findOne({
        where: {
          name: request.params.name,
        },
      });
      if (mode) {
        return h.response(mode).code(200);
      }
      return h.response({ error: "Mode not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve mode" }).code(500);
    }
  },
};

module.exports = modesController;
