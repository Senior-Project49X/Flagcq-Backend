"use strict";
const path = require("path");
const questionController = require("../controllers/questionController");

const questionRoute = [
  {
    method: "POST",
    path: "/api/question",
    handler: questionController.creatQuestion,
  },
  {
    method: "GET",
    path: "/api/questions",
    handler: questionController.getQuestion,
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
];

module.exports = questionRoute;
