"use strict";

const db = require("../models");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
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
        file,
      } = request.payload;

      const parsedPoint = Number(point);
      if (isNaN(parsedPoint)) {
        return h.response({ message: "Valid Point is required" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const existingTitle = await Question.findOne({
        where: { title },
      });

      if (existingTitle) {
        return h.response({ message: "Title already exists" }).code(409);
      }

      const existingFile = await Question.findOne({
        where: { file_path: file.filename },
      });

      if (existingFile) {
        return h.response({ message: "File already exists" }).code(409);
      }

      let file_path = null;
      if (file && file.filename) {
        const fileName = `${file.filename}`;
        const filePath = path.join(__dirname, "..", "uploads", fileName);

        try {
          const fileData = fs.readFileSync(file.path);
          fs.writeFileSync(filePath, fileData);
          file_path = fileName;
        } catch (err) {
          console.error("Error writing file:", err);
          return h.response({ message: "Failed to upload file" }).code(500);
        }
      }

      const catagory = await Category.findOne({
        where: {
          name: categories_id,
        },
        attributes: ["id"],
      });

      if (!catagory) {
        return h.response({ message: "Category not found" }).code(404);
      }

      const question = await Question.create({
        categories_id: catagory.id,
        title,
        Description,
        Answer,
        point: parsedPoint,
        difficultys_id,
        file_path,
        type,
        createdBy: `${decoded.first_name} ${decoded.last_name}`,
      });
      return h.response(question).code(201);
    } catch (error) {
      console.error(error);
      return h.response({ message: error.message }).code(500);
    }
  },
  // getQuestionTournament: async (request, h) => {
  //   try {
  //     const { page = 1, limit = 16, category, Difficulty } = request.query;
  //     const offset = (page - 1) * limit;
  //     const where = { type: "Tournament" };

  //     if (category) {
  //       where.categories_id = category;
  //     }

  //     if (Difficulty) {
  //       where.difficultys_id = Difficulty;
  //     }

  //     const token = request.state["cmu-oauth-token"];
  //     if (!token) {
  //       return h.response({ message: "Unauthorized" }).code(401);
  //     }

  //     const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  //     if (!decoded) {
  //       return h.response({ message: "Invalid token" }).code(401);
  //     }

  //     const user = await User.findOne({
  //       where: { student_id: decoded.student_id },
  //     });

  //     if (!user) {
  //       return h.response({ message: "User not found" }).code(404);
  //     }

  //     const question = await Question.findAndCountAll({
  //       where,
  //       limit: parseInt(limit),
  //       offset: parseInt(offset),
  //       order: [["difficultys_id", "ASC"]],
  //     });

  //     const solvedQuestions = await Submited.findAll({
  //       where: { users_id: decoded.user_id },
  //       attributes: ["question_id"],
  //     });

  //     const solvedIds = solvedQuestions.map((item) => item.question_id);

  //     return h
  //       .response({
  //         data: question.rows,
  //         totalItems: question.count,
  //         currentPage: page,
  //       })
  //       .code(200);
  //   } catch (error) {
  //     return h.response({ message: error.message }).code(500);
  //   }
  // },
  getQuestionById: async (request, h) => {
    try {
      const questionId = parseInt(request.params.id, 10);
      if (isNaN(questionId)) {
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: { student_id: decoded.student_id },
      });

      const question = await Question.findByPk(questionId, {
        attributes: {
          exclude: ["Answer", "createdAt", "createdBy", "updatedAt", "type"],
        },
        include: [
          {
            model: Category,
            as: "Category",
            attributes: ["name"],
          },
        ],
      });

      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      const isSolved = await Submited.findOne({
        where: { users_id: user.user_id, question_id: question.id },
      });

      const data = {
        id: question.id,
        title: question.title,
        description: question.Description,
        point: question.point,
        categories_name: question.Category?.name || null,
        // categories_id: question.categories_id,
        difficultys_id: question.difficultys_id,
        file_path: question.file_path,
        author: question.createdBy,
        solved: !!isSolved,
      };

      return h.response(data).code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  getQuestion: async (request, h) => {
    try {
      const {
        page = 1,
        limit = 16,
        category,
        Difficulty,
        type,
      } = request.query;

      const offset = (page - 1) * limit;
      const where = {};

      const validTypes = ["Practice", "Tournament"];

      if (type) {
        if (!validTypes.includes(type)) {
          return h.response({ message: "Invalid type parameter" }).code(400);
        }
        where.type = type;
      }

      if (category) {
        const validCategory = await Category.findOne({
          where: { name: category },
          attributes: ["id"],
        });

        if (!validCategory) {
          return h.response({ message: "Category not found" }).code(404);
        }
        where.categories_id = validCategory.id;
      }

      if (Difficulty) {
        where.difficultys_id = Difficulty;
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const user = await User.findOne({
        where: { student_id: decoded.student_id },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const question = await Question.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [["difficultys_id", "ASC"]],
        attributes: {
          exclude: ["Answer", "createdAt", "createdBy", "updatedAt", "type"],
        },
        include: [
          {
            model: Category,
            as: "Category",
            attributes: ["name"],
          },
        ],
      });

      const solvedQuestions = await Submited.findAll({
        where: { users_id: user.user_id },
        attributes: ["question_id"],
      });

      const solvedIds = solvedQuestions.map((item) => item.question_id);

      const mappedData = question.rows.map((q) => ({
        id: q.id,
        title: q.title,
        // description: q.Description,
        point: q.point,
        categories_name: q.Category?.name || null,
        // categories_id: q.categories_id,
        difficultys_id: q.difficultys_id,
        file_path: q.file_path,
        author: q.createdBy,
        solved: solvedIds.includes(q.id),
      }));

      return h
        .response({
          data: mappedData,
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
        type,
        file,
      } = request.payload;

      const existingTitle = await Question.findOne({
        where: { title },
      });

      if (existingTitle) {
        return h.response({ message: "Title already exists" }).code(409);
      }

      const existingFile = await Question.findOne({
        where: { file_path: file.filename },
      });

      if (existingFile) {
        return h.response({ message: "File already exists" }).code(409);
      }

      let file_path = question.file_path;
      if (file && file.filename) {
        const fileName = `${file.filename}`;
        const filePath = path.join(__dirname, "..", "uploads", fileName);

        try {
          const fileData = fs.readFileSync(file.path);
          fs.writeFileSync(filePath, fileData);
          file_path = fileName;
        } catch (err) {
          console.error("Error writing file:", err);
          return h.response({ message: "Failed to upload file" }).code(500);
        }
      } else if (file) {
        return h.response({ message: "Invalid file structure" }).code(400);
      }

      if (categories_id) {
        const category = await Category.findOne({
          where: { name: categories_id },
          attributes: ["id"],
        });

        if (!category) {
          return h.response({ message: "Category not found" }).code(404);
        }
        question.categories_id = category.id;
      }

      if (title !== undefined) question.title = title;
      if (Description !== undefined) question.Description = Description;
      if (Answer !== undefined) question.Answer = Answer;
      if (point !== undefined) {
        const parsedPoint = Number(point);
        if (isNaN(parsedPoint)) {
          return h.response({ message: "Valid Point is required" }).code(400);
        }
        question.point = parsedPoint;
      }

      const validDifficulties = ["Easy", "Medium", "Hard"];
      const validTypes = ["Practice", "Tournament"];

      if (difficultys_id !== undefined) {
        if (!validDifficulties.includes(difficultys_id)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
        question.difficultys_id = difficultys_id;
      }

      if (type !== undefined) {
        if (!validTypes.includes(type)) {
          return h.response({ message: "Invalid type parameter" }).code(400);
        }
        question.type = type;
      }

      question.file_path = file_path;

      await question.save();
      return h.response(question).code(200);
    } catch (error) {
      console.error("Error in updateQuestion:", error.message);
      return h.response({ message: error.message }).code(500);
    }
  },
  deleteQuestion: async (request, h) => {
    try {
      const questionId = parseInt(request.params.id, 10);
      if (isNaN(questionId)) {
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const question = await Question.findByPk(questionId);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      await question.destroy();

      return h.response({ message: "Question has been deleted" }).code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  checkAnswer: async (request, h) => {
    try {
      const { Answer, id } = request.payload;
      const question = await Question.findByPk(id);
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
      if (answer === Answer) {
        const user = await User.findOne({
          where: {
            student_id: decoded.student_id,
          },
        });

        if (!user) {
          return h.response({ message: "User not found" }).code(404);
        }

        let point = await Point.findOne({
          where: { users_id: user.user_id },
        });

        if (!point) {
          return h.response({ message: "Point not found" }).code(404);
        }

        const existingSubmission = await Submited.findOne({
          where: {
            users_id: user.user_id,
            question_id: question.id,
          },
        });

        if (existingSubmission) {
          return h.response({ message: "Already submitted" }).code(200);
        }

        await Submited.create({
          users_id: user.user_id,
          question_id: question.id,
        });

        point.points += question.point;
        await point.save();

        return h.response({ message: "Correct", solve: true }).code(200);
      } else {
        return h.response({ message: "Incorrect", solve: false }).code(200);
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

      if (!question.file_path) {
        return h
          .response({ message: "No file available for this question" })
          .code(400);
      }

      const filePath = path.resolve(
        __dirname,
        "..",
        "uploads",
        question.file_path
      );

      return h.file(filePath, {
        confine: false,
        mode: "attachment",
        filename: question.file_path,
        headers: {
          "Content-Disposition": `attachment; filename=${question.file_path}`,
        },
      });
    } catch (error) {
      console.log(error);
      return h.response({ message: error.message }).code(500);
    }
  },
};

module.exports = questionController;
