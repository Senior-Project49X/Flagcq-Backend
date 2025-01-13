"use strict";

const db = require("../models");
const jwt = require("jsonwebtoken");
const Category = db.Category;
const User = db.User;

const categoryController = {
  getAllCategories: async (request, h) => {
    try {
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded) {
        return h.response({ error: "Invalid token" }).code(401);
      }

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
      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded) {
        return h.response({ error: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });
      if (!user) {
        return h.response({ error: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ error: "Unauthorized" }).code(401);
      }

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
      const categoryId = parseInt(request.params.id, 10);
      if (isNaN(categoryId)) {
        return h.response({ error: "Invalid category ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded) {
        return h.response({ error: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });
      if (!user) {
        return h.response({ error: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      const category = await Category.findByPk(categoryId);
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
      const categoryId = parseInt(request.params.id, 10);
      if (isNaN(categoryId)) {
        return h.response({ error: "Invalid category ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded) {
        return h.response({ error: "Invalid token" }).code(401);
      }

      const category = await Category.findByPk(categoryId);
      if (category) {
        return h.response(category).code(200);
      }
      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to retrieve category" }).code(500);
    }
  },
};

module.exports = categoryController;
