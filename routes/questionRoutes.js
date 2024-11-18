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
    path: "/api/question/tournament",
    handler: questionController.getQuestionTournament,
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
    path: "/api/question/practice",
    handler: questionController.getQuestionPractice,
  },
];

module.exports = questionRoute;
