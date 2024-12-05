"use strict";
const path = require("path");
const questionController = require("../controllers/questionController");
const Joi = require("joi");
const { validate } = require("uuid");

const questionRoute = [
  {
    method: "POST",
    path: "/api/question",
    options: {
      payload: {
        output: "file",
        parse: true,
        allow: "multipart/form-data",
        multipart: {
          output: "file",
        },
        maxBytes: 200 * 1024 * 1024,
      },
      validate: {
        payload: Joi.object({
          categories_id: Joi.string().required(),
          title: Joi.string().trim().min(1).required(),
          Description: Joi.string().trim().min(1).required(),
          Answer: Joi.string().trim().min(1).required(),
          point: Joi.string().required(),

          difficultys_id: Joi.string()
            .valid("Easy", "Medium", "Hard")
            .required(),
          file: Joi.object({
            filename: Joi.string()
              .regex(/\.zip$/)
              .required(),
            headers: Joi.object({
              "content-type": Joi.string()
                .valid("application/zip", "application/x-zip-compressed")
                .required(),
            }).unknown(true),
          }),
          Practice: Joi.string().required(),
          Tournament: Joi.string().required(),
        }),
      },
    },
    handler: questionController.createQuestion,
  },
  {
    method: "GET",
    path: "/api/question/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required(),
        }),
      },
    },
    handler: questionController.getQuestionById,
  },
  {
    method: "DELETE",
    path: "/api/question/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required(),
        }),
      },
    },
    handler: questionController.deleteQuestion,
  },
  {
    method: "POST",
    path: "/api/question/practice/check-answer",
    options: {
      validate: {
        payload: Joi.object({
          id: Joi.number().integer().required(),
          Answer: Joi.string().trim().min(1).required(),
        }),
      },
    },
    handler: questionController.checkAnswerPractice,
  },
  {
    method: "POST",
    path: "/api/question/tournament/check-answer",
    options: {
      validate: {
        payload: Joi.object({
          question_id: Joi.number().integer().required(),
          tournament_id: Joi.number().integer().required(),
          Answer: Joi.string().trim().min(1).required(),
        }),
      },
    },
    handler: questionController.checkAnswerTournament,
  },
  {
    method: "GET",
    path: "/api/question/download/{id}",
    options: {
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required(),
        }),
      },
    },
    handler: questionController.downloadFile,
  },
  {
    method: "GET",
    path: "/api/questions/practice",
    options: {
      validate: {
        query: Joi.object({
          page: Joi.string().required(),
          mode: Joi.string().required(),
        }),
      },
    },
    handler: questionController.getQuestionPractice,
  },
  {
    method: "GET",
    path: "/api/questions/tournament",
    options: {
      validate: {
        query: Joi.object({
          page: Joi.number().integer().required(),
          mode: Joi.number().integer().required(),
        }),
      },
    },
    handler: questionController.getQuestionTournament,
  },
  {
    method: "PUT",
    path: "/api/questions/{id}",
    options: {
      payload: {
        output: "file",
        parse: true,
        allow: "multipart/form-data",
        multipart: {
          output: "file",
        },
        maxBytes: 200 * 1024 * 1024,
      },
      validate: {
        payload: Joi.object({
          categories_id: Joi.string(),
          title: Joi.string().trim().min(1),
          Description: Joi.string().trim().min(1),
          Answer: Joi.string().trim().min(1),
          point: Joi.string(),

          difficultys_id: Joi.string().valid("Easy", "Medium", "Hard"),
          file: Joi.object({
            filename: Joi.string()
              .regex(/\.zip$/)
              .required(),
            headers: Joi.object({
              "content-type": Joi.string()
                .valid("application/zip", "application/x-zip-compressed")
                .required(),
            }).unknown(true),
          }),
          Practice: Joi.string(),
          Tournament: Joi.string(),
        }),
      },
    },
    handler: questionController.updateQuestion,
  },
];

module.exports = questionRoute;
