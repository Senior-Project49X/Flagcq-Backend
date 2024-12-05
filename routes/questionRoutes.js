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
          categories_id: Joi.number().integer().required(),
          title: Joi.string().trim().min(1).required(),
          Description: Joi.string().trim().min(1).required(),
          Answer: Joi.string().trim().min(1).required(),
          point: Joi.number().integer().required(),

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
          Practice: Joi.boolean().required(),
          Tournament: Joi.array().items(Joi.string()).required(),
        }),
      },
    },
    handler: questionController.creatQuestion,
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
    option: {
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
    option: {
      validate: {
        query: Joi.object({
          page: Joi.number().integer().required(),
          mode: Joi.number().integer().required(),
        }),
      },
    },
    handler: questionController.getQuestionPractice,
  },
  {
    method: "GET",
    path: "/api/questions/tournament",
    option: {
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
          categories_id: Joi.number().integer(),
          title: Joi.string().trim().min(1),
          Description: Joi.string().trim().min(1),
          Answer: Joi.string().trim().min(1),
          point: Joi.number().integer(),
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
          Practice: Joi.boolean(),
          Tournament: Joi.array().items(Joi.string()),
        }),
      },
    },
    handler: questionController.updateQuestion,
  },
];

module.exports = questionRoute;
