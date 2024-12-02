"use strict";
const path = require("path");
const questionController = require("../controllers/questionController");
const Joi = require("joi");

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
          file: Joi.object({
            filename: Joi.string()
              .regex(/\.zip$/)
              .required(),
            headers: Joi.object({
              "content-type": Joi.string()
                .valid("application/zip", "application/x-zip-compressed")
                .required(),
            }).unknown(true),
          }).required(),
        }),
      },
    },
    handler: questionController.creatQuestion,
  },
  {
    method: "GET",
    path: "/api/question/{id}",
    handler: questionController.getQuestionById,
  },
  {
    method: "DELETE",
    path: "/api/question/{id}",
    handler: questionController.deleteQuestion,
  },
  {
    method: "POST",
    path: "/api/question/check-answer",
    handler: questionController.checkAnswer,
  },
  {
    method: "GET",
    path: "/api/question/download/{id}",
    handler: questionController.downloadFile,
  },
  {
    method: "GET",
    path: "/api/questions",
    handler: questionController.getQuestion,
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
          file: Joi.object({
            filename: Joi.string()
              .regex(/\.zip$/)
              .required(),
            headers: Joi.object({
              "content-type": Joi.string()
                .valid("application/zip", "application/x-zip-compressed")
                .required(),
            }).unknown(true),
          }).required(),
        }),
      },
    },
    handler: questionController.updateQuestion,
  },
];

module.exports = questionRoute;
