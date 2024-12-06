"use strict";

const db = require("../models");
const Category = db.Category;

const categoryController = {
  getAllCategories: async (request, h) => {
    try {
      const categories = await Category.findAll({
        attributes: ["id", "name"],
      });
      return h.response(categories).code(200);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve categories" }).code(500);
    }
  },
  createCategory: async (request, h) => {
    try {
      const { name } = request.payload;

      if (!name || name.trim() === "") {
        return h.response({ error: "Category name is required" }).code(400);
      }

      const newCategory = await Category.create({ name });
      return h.response(newCategory).code(201);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to create category" }).code(500);
    }
  },
  deleteCategory: async (request, h) => {
    try {
      const category = await Category.findByPk(request.params.id);
      if (category) {
        await category.destroy();
        return h.response().code(204);
      }
      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to delete category" }).code(500);
    }
  },
  getCategoriesById: async (request, h) => {
    try {
      const category = await Category.findByPk(request.params.id);
      if (category) {
        return h.response(category).code(200);
      }
      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve category" }).code(500);
    }
  },
  getCategoriesByNames: async (request, h) => {
    try {
      const category = await Category.findOne({
        where: {
          name: request.params.name,
        },
        attributes: ["id"],
      });
      if (category) {
        return h.response({ id: category.id }).code(200);
      }
      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve category" }).code(500);
    }
  },
};

module.exports = categoryController;
