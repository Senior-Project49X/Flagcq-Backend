"use strict";
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
    path: "/api/question",
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
    path: "/api/question/download",
    handler: questionController.downloadFile,
  },
  {
    method: "GET",
    path: "/api/questions/user",
    handler: questionController.getQuestionUser,
  },
  {
    method: "GET",
    path: "/api/questions/admin",
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
    path: "/api/question/usehint",
    handler: questionController.UseHint,
  },
  {
    method: "POST",
    path: "/api/questions/tournament",
    handler: questionController.addQuestionToTournament,
  },
  {
    method: "DELETE",
    path: "/api/questions/tournament/{tournamentId}/question/{questionIds}",
    handler: questionController.deleteQuestionFromTournament,
  },
  {
    method: "GET",
    path: "/api/question/user-list",
    handler: questionController.getUserSubmitted,
  },
];

module.exports = questionRoute;
