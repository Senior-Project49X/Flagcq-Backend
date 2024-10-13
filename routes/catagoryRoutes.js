"use strict";

const categoryController = require("../controllers/categoryController");

const categoryRoute = [
  {
    method: "GET",
    path: "/api/categories",
    handler: categoryController.getAllCategories,
  },
  {
    method: "POST",
    path: "/api/categories",
    handler: categoryController.createCategory,
  },
  {
    method: "DELETE",
    path: "/api/categories/{id}",
    handler: categoryController.deleteCategory,
  },
];

module.exports = categoryRoute;
