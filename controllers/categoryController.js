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

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ error: "User not found" }).code(404);
      }

      const categories = await Category.findAll({
        attributes: ["id", "name"],
      });
      return h.response(categories).code(200);
    } catch (error) {
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

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
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
      return h.response({ error: "Unable to create category" }).code(500);
    }
  },
  deleteCategory: async (request, h) => {
    try {
      const categoryId = parseInt(request.params.id, 10);
      if (isNaN(categoryId) || categoryId <= 0) {
        return h.response({ error: "Invalid category ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
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
        return h.response({ message: "Category has been deleted" }).code(204);
      }
      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      return h.response({ error: "Unable to delete category" }).code(500);
    }
  },
  getCategoriesById: async (request, h) => {
    try {
      const categoryId = parseInt(request.params.id, 10);
      if (isNaN(categoryId) || categoryId <= 0) {
        return h.response({ error: "Invalid category ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ error: "User not found" }).code(404);
      }

      const category = await Category.findByPk(categoryId);
      if (category) {
        return h.response(category).code(200);
      }
      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      return h.response({ error: "Unable to retrieve category" }).code(500);
    }
  },
  updateCategory: async (request, h) => {
    try {
      const categoryId = parseInt(request.params.id, 10);
      if (isNaN(categoryId) || categoryId <= 0) {
        return h.response({ error: "Invalid category ID" }).code(400);
      }

      const { name } = request.payload;
      if (!name || name.trim() === "") {
        return h.response({ error: "Category name is required" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ error: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
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
        category.name = name;
        await category.save();
        return h.response(category).code(200);
      }

      return h.response({ error: "Category not found" }).code(404);
    } catch (error) {
      console.error(error);
      return h.response({ error: "Unable to update category" }).code(500);
    }
  },
};

module.exports = categoryController;
