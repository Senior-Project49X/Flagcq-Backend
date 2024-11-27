"use strict";
const path = require("path");
const questionController = require("../controllers/questionController");

const questionRoute = [
  {
    method: "POST",
    path: "/api/question",
    options: {
      payload: {
        output: "file",
        parse: true,
        allow: ["multipart/form-data"],
        multipart: true,
        maxBytes: 209715200,
      },
    },
    handler: questionController.creatQuestion,
  },
  // {
  //   method: "GET",
  //   path: "/api/question/tournament",
  //   handler: questionController.getQuestionTournament,
  // },
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
        allow: ["multipart/form-data"],
        multipart: true,
        maxBytes: 209715200,
      },
    },
    handler: questionController.updateQuestion,
  },
];

module.exports = questionRoute;
