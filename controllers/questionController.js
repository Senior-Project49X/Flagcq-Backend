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
const Mode = db.Mode;
const { Op } = require("sequelize");
const QuestionMode = db.QuestionMode;

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
        file,
        Modes, //array of modes
      } = request.payload;

      const parsedPoint = Number(point);
      if (isNaN(parsedPoint)) {
        return h.response({ message: "Valid Point is required" }).code(400);
      }

      const validDifficulties = ["Easy", "Medium", "Hard"];
      if (!validDifficulties.includes(difficultys_id)) {
        return h
          .response({ message: "Invalid difficulty parameter" })
          .code(400);
      }

      if (!title || title.trim() === "") {
        return h.response({ error: "Title is required" }).code(400);
      }

      if (!Description || Description.trim() === "") {
        return h.response({ error: "Description is required" }).code(400);
      }

      if (!Answer || Answer.trim() === "") {
        return h.response({ error: "Answer is required" }).code(400);
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

      const parsedCategoriesId = parseInt(categories_id, 10);
      if (isNaN(parsedCategoriesId)) {
        return h.response({ message: "Invalid category ID" }).code(400);
      }

      const catagory = await Category.findOne({
        where: {
          id: parsedCategoriesId,
        },
        attributes: ["id"],
      });

      if (!catagory) {
        return h.response({ message: "Category not found" }).code(404);
      }

      let file_path = null;
      if (file && file.filename) {
        const fileName = `${file.filename}`;
        const uploadDirectory = path.join(__dirname, "..", "uploads");
        const filePath = path.join(uploadDirectory, fileName);

        try {
          await fs.promises.mkdir(uploadDirectory, { recursive: true });

          await fs.promises.writeFile(
            filePath,
            await fs.promises.readFile(file.path)
          );
          file_path = fileName;
        } catch (err) {
          console.error("Error uploading file:", err);
          return h.response({ message: "Failed to upload file" }).code(500);
        }
      }

      const question = await Question.create({
        categories_id: catagory.id,
        title,
        Description,
        Answer,
        point: parsedPoint,
        difficultys_id,
        file_path,
        createdBy: `${decoded.first_name} ${decoded.last_name}`,
      });

      let modeId = [];
      if (Modes.includes("None")) {
        const noneMode = await Mode.findOne({ where: { name: "None" } });
        if (!noneMode) {
          return h.response({ message: "Mode 'None' not found" }).code(404);
        }
        modeId = [noneMode.id];
      } else {
        const validModes = await Mode.findAll({
          where: {
            name: { [Op.in]: Modes },
          },
        });

        if (validModes.length !== Modes.length) {
          return h.response({ message: "Some modes are invalid" }).code(400);
        }

        modeId = validModes.map((mode) => mode.id);
      }

      const questionMode = modeId.map((mode) => ({
        question_id: question.id,
        mode_id: mode,
      }));

      await QuestionMode.bulkCreate(questionMode);

      return h.response(question).code(201);
    } catch (error) {
      console.error(error);
      return h.response({ message: error.message }).code(500);
    }
  },
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
          exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
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
      const { page = 1, category, Difficulty, mode } = request.query;

      const limit = 12;
      const offset = (page - 1) * limit;
      const validDifficulties = ["Easy", "Medium", "Hard"];
      const where = {};

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
        if (!validDifficulties.includes(Difficulty)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
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

      if (mode) {
        const validMode = await Mode.findOne({
          where: { name: mode },
          attributes: ["id"],
        });

        if (!validMode) {
          return h.response({ message: "Mode not found" }).code(404);
        }

        where.id = {
          [Op.in]: (
            await QuestionMode.findAll({
              where: { mode_id: validMode.id },
              attributes: ["question_id"],
            })
          ).map((item) => item.question_id),
        };
      }

      const question = await Question.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [
          ["difficultys_id", "ASC"],
          ["id", "ASC"],
        ],
        attributes: {
          exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
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
        point: q.point,
        categories_name: q.Category?.name || null,
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
    const transaction = await sequelize.transaction();
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

      const {
        categories_id,
        title,
        Description,
        Answer,
        point,
        difficultys_id,
        Modes,
        file,
      } = request.payload;

      const existingTitle = await Question.findOne({
        where: { title, id: { [Op.ne]: questionId } },
      });
      if (existingTitle) {
        return h.response({ message: "Title already exists" }).code(409);
      }

      if (file?.filename) {
        const existingFile = await Question.findOne({
          where: { file_path: file.filename },
        });
        if (existingFile) {
          return h.response({ message: "File already exists" }).code(409);
        }
      }

      let file_path = question.file_path;
      if (file?.filename && file?.path) {
        if (question.file_path) {
          try {
            fs.unlinkSync(
              path.join(__dirname, "..", "uploads", question.file_path)
            );
          } catch (err) {
            console.warn("Failed to delete old file:", err);
          }
        }

        const uploadDirectory = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDirectory)) {
          fs.mkdirSync(uploadDirectory, { recursive: true });
        }

        const newFilePath = path.join(uploadDirectory, file.filename);
        fs.writeFileSync(newFilePath, fs.readFileSync(file.path));
        file_path = file.filename;
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
      if (difficultys_id && !validDifficulties.includes(difficultys_id)) {
        return h
          .response({ message: "Invalid difficulty parameter" })
          .code(400);
      }
      question.difficultys_id = difficultys_id || question.difficultys_id;

      question.file_path = file_path;

      if (Modes) {
        let validModes;
        if (Modes.includes("none")) {
          validModes = await Mode.findAll({ where: { name: "none" } });
          if (!validModes.length) {
            return h.response({ message: "Mode 'none' not found" }).code(404);
          }
        } else {
          validModes = await Mode.findAll({
            where: { name: { [Op.in]: Modes } },
          });
          if (validModes.length !== Modes.length) {
            return h.response({ message: "Some modes are invalid" }).code(400);
          }
        }

        const newQuestionModes = validModes.map((mode) => ({
          question_id: questionId,
          mode_id: mode.id,
        }));

        await QuestionMode.destroy({
          where: { question_id: questionId },
          transaction,
        });
        await QuestionMode.bulkCreate(newQuestionModes, { transaction });
      }

      await question.save({ transaction });
      await transaction.commit();

      return h.response(question).code(200);
    } catch (error) {
      if (transaction) await transaction.rollback();
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

      if (question.file_path) {
        const filePath = path.resolve(
          __dirname,
          "..",
          "uploads",
          question.file_path
        );

        try {
          await fs.promises.access(filePath);
          await fs.promises.unlink(filePath);
        } catch (err) {
          if (err.code !== "ENOENT") {
            console.error("Error deleting file:", err);
            return h
              .response({ message: "Failed to delete associated file" })
              .code(500);
          }
        }
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
