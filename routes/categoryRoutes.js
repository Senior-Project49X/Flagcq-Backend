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
  {
    method: "GET",
    path: "/api/categories/{id}",
    handler: categoryController.getCategoriesById,
  },
  {
    method: "GET",
    path: "/api/categories/name/{name}",
    handler: categoryController.getCategoriesByNames,
  },
];

module.exports = categoryRoute;
