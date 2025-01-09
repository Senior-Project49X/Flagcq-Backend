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
        allow: "multipart/form-data",
        multipart: {
          output: "file",
        },
        maxBytes: 200 * 1024 * 1024,
      },
    },
    handler: questionController.createQuestion,
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
    path: "/api/question/practice/check-answer",
    handler: questionController.checkAnswerPractice,
  },
  {
    method: "POST",
    path: "/api/question/tournament/check-answer",
    handler: questionController.checkAnswerTournament,
  },
  {
    method: "GET",
    path: "/api/question/download/{id}",
    handler: questionController.downloadFile,
  },
  {
    method: "GET",
    path: "/api/questions/practice",
    handler: questionController.getQuestionPractice,
  },
  {
    method: "GET",
    path: "/api/questions/tournament",
    handler: questionController.getQuestionTournament,
  },
  {
    method: "GET",
    path: "/api/questions",
    handler: questionController.getAllQuestions,
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
    },
    handler: questionController.updateQuestion,
  },
  {
    method: "GET",
    path: "/api/question/hint/{id}",
    handler: questionController.getHintByID,
  },
  {
    method: "GET",
    path: "/api/question/usehint/{id}",
    handler: questionController.UseHint,
  },
];

module.exports = questionRoute;
