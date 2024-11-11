"use strict";

const db = require("../models");
const Question = db.Question;
const User = db.User;
const Submited = db.Submited;
const Point = db.Point;

const questionController = {
  creatQuestion: async (request, h) => {
    try {
      const {
        categories_id,
        title,
        Description,
        Answer,
        point,
        difficultys_id,
        file_path,
        type,
      } = request.payload;
      const question = await Question.create({
        categories_id,
        title,
        Description,
        Answer,
        point,
        difficultys_id,
        file_path,
        type,
      });
      return h.response(question).code(201);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  getQuestion: async (request, h) => {
    try {
      const question = await Question.findAll();
      return h.response(question).code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  getQuestionById: async (request, h) => {
    try {
      const question = await Question.findByPk(request.params.id);
      return h.response(question).code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  deleteQuestion: async (request, h) => {
    try {
      const question = await Question.findByPk(request.params.id);
      await question.destroy();
      return h.response({ message: "Question has been deleted" }).code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  checkAnswer: async (request, h) => {
    try {
      const question = await Question.findByPk(request.params.id);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      if (question.Answer === request.payload.Answer) {
        const user = await User.findOne({
          where: {
            student_id: decoded.student_id,
          },
        });

        if (!user) {
          return h.response({ message: "User not found" }).code(404);
        }

        let point = await Point.findByPk(user.user_id);
        if (!point) {
          point = await Point.create({ user_id: user.user_id });
        }

        let submitted = await Submited.findOne({
          where: {
            user_id: user.user_id,
            question_id: question.id,
          },
        });

        if (!submitted) {
          await Submited.create({
            user_id: user.user_id,
            question_id: question.id,
          });

          point.points += question.point;
          await point.save();
        }

        return h.response({ message: "Correct" }).code(200);
      } else {
        return h.response({ message: "Incorrect" }).code(200);
      }
    } catch (err) {
      console.error(err);
      return h.response({ message: "Internal Server Error" }).code(500);
    }
  },

  downloadFile: async (request, h) => {
    try {
      const question = await Question.findByPk(request.params.id);
      return h.file(question.file_path);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
};

module.exports = questionController;
