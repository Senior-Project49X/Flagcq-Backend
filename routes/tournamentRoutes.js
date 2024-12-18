"use strict";

const Joi = require("joi"); // Import Joi for payload validation
const tournamentController = require("../controllers/tournamentController");

const tournamentRoutes = [
  {
    method: "POST",
    path: "/api/createtournament", // API endpoint for creating a tournament
    options: {
      validate: {
        payload: Joi.object({
          name: Joi.string().max(50).required().messages({
            "string.base": "Name must be a string.",
            "string.max": "Name cannot exceed 50 characters.",
            "any.required": "Name is required.",
          }),
          description: Joi.string().max(500).required().messages({
            "string.base": "Description must be a string.",
            "string.max": "Description cannot exceed 500 characters.",
            "any.required": "Description is required.",
          }),
          enroll_startDate: Joi.date().iso().required().messages({
            "date.base": "Enroll start date must be a valid date.",
            "any.required": "Enroll start date is required.",
          }),
          enroll_endDate: Joi.date().iso().required().messages({
            "date.base": "Enroll end date must be a valid date.",
            "any.required": "Enroll end date is required.",
          }),
          event_startDate: Joi.date().iso().required().messages({
            "date.base": "Event start date must be a valid date.",
            "any.required": "Event start date is required.",
          }),
          event_endDate: Joi.date().iso().required().messages({
            "date.base": "Event end date must be a valid date.",
            "any.required": "Event end date is required.",
          }),
        }),
        failAction: (request, h, err) => {
          return h.response({ message: err.message }).code(400).takeover();
        },
      },
      description: "Create a new tournament",
      notes: "Allows basic creation of tournaments with proper dates.",
      tags: ["api", "tournaments"], // Useful for Swagger documentation
    },
    handler: tournamentController.createTournament,
  },
];

module.exports = tournamentRoutes;
