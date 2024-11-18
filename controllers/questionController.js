"use strict";

const db = require("../models");
const jwt = require("jsonwebtoken");
const Question = db.Question;
const User = db.User;
const Submited = db.Submited;
const Point = db.Point;
const Category = db.Category;

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
        type,
      } = request.payload;

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const file = request.payload.file;
      let file_path = null;
      if (file && file.hapi) {
        const uploadDir = path.join(__dirname, "uploads");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir);
        }

        const filename = file.hapi.filename;
        const data = file._data;
        fs.writeFileSync(path.join(uploadDir, filename), data);
        file_path = filename;
      }

      const catagory = await Category.findOne({
        where: {
          name: categories_id,
        },
        attributes: ["id"],
      });

      const id = catagory.id;

      if (!id) {
        return h.response({ message: "Category not found" }).code(404);
      }

      const question = await Question.create({
        categories_id: id,
        title,
        Description,
        Answer,
        point,
        difficultys_id,
        file_path,
        type,
        createdBy: decoded.first_name + " " + decoded.last_name,
      });
      return h.response(question).code(201);
    } catch (error) {
      console.error(error);
      return h.response({ message: error.message }).code(500);
    }
  },
  getQuestionTournament: async (request, h) => {
    try {
      const { page = 1, limit = 16, category, Difficulty } = request.query;
      const offset = (page - 1) * limit;
      const where = { type: "Tournament" };

      if (category) {
        where.categories_id = category;
      }

      if (Difficulty) {
        where.difficultys_id = Difficulty;
      }

      const question = await Question.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["difficultys_id", "ASC"]],
      });

      return h
        .response({
          data: question.rows,
          totalItems: question.count,
          currentPage: page,
        })
        .code(200);
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
  getQuestionPractice: async (request, h) => {
    try {
      const { page = 1, limit = 16, category, Difficulty } = request.query;
      const offset = (page - 1) * limit;
      const where = { type: "Practice" };

      if (category) {
        where.categories_id = category;
      }

      if (Difficulty) {
        where.difficultys_id = Difficulty;
      }

      const question = await Question.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["difficultys_id", "ASC"]],
      });

      return h
        .response({
          data: question.rows,
          totalItems: question.count,
          currentPage: page,
        })
        .code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  updateQuestion: async (request, h) => {
    try {
      const question = await Question.findByPk(request.params.id);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

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

      const catagory = await Category.findOne({
        where: {
          name: categories_id,
        },
        attributes: ["id"],
      });

      if (!id) {
        return h.response({ message: "Category not found" }).code(404);
      }

      question.categories_id = catagory.id;
      question.title = title;
      question.Description = Description;
      question.Answer = Answer;
      question.point = point;
      question.difficultys_id = difficultys_id;
      question.file_path = file_path;
      question.type = type;

      await question.save();
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

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const answer = "CTFCQ{" + question.Answer + "}";
      if (answer === request.payload.Answer) {
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

        await Submited.create({
          users_id: user.user_id,
          question_id: question.id,
        });

        point.points += question.point;
        await point.save();

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
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      const filePath = path.join(__dirname, "uploads", question.file_path);
      if (!fs.existsSync(filePath)) {
        return h.response({ message: "File not found" }).code(404);
      }

      return h.file(question.file_path);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
};

module.exports = questionController;
