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
const sequelize = db.sequelize;
const { Op } = require("sequelize");
const Tournaments = db.Tournament;
const QuestionTournament = db.QuestionTournament;
const TournamentSubmited = db.TournamentSubmited;
const TournamentPoints = db.TournamentPoints;
const TeamScores = db.TeamScores;
const Hint = db.Hint;
const HintUsed = db.HintUsed;

const questionController = {
  createQuestion: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const {
        categories_id,
        title,
        Description,
        Answer,
        point,
        difficultys_id,
        file,
        Practice,
        Hints,
        Tournament,
      } = request.payload;

      let ArrayHint;
      try {
        ArrayHint = JSON.parse(Hints);
      } catch (error) {
        return h.response({ message: "Invalid Hints format" }).code(400);
      }

      const parsedCategoriesId = parseInt(categories_id, 10);
      if (isNaN(parsedCategoriesId)) {
        return h.response({ message: "Invalid categories_id" }).code(400);
      }

      const parsedPoint = parseInt(point, 10);
      if (isNaN(parsedPoint) || parsedPoint <= 0) {
        return h.response({ message: "Invalid point" }).code(400);
      }

      const validDifficulties = ["Easy", "Medium", "Hard"];
      if (!title || !Description || !Answer || !difficultys_id) {
        return h.response({ message: "Missing required fields" }).code(400);
      }

      if (!validDifficulties.includes(difficultys_id)) {
        return h
          .response({ message: "Invalid difficulty parameter" })
          .code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
      }

      const user = await User.findOne({
        where: { itaccount: decoded.email },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const existingTitle = await Question.findOne({
        where: { title },
      });

      if (existingTitle) {
        return h.response({ message: "Topic already exists" }).code(409);
      }

      const existingFile = await Question.findOne({
        where: { file_path: file.filename },
      });

      if (existingFile) {
        return h.response({ message: "File already exists" }).code(409);
      }

      const category = await Category.findOne({
        where: { id: parsedCategoriesId },
        attributes: ["id"],
      });

      if (!category) {
        return h.response({ message: "Category not found" }).code(404);
      }

      let file_path = null;
      if (file && file.filename) {
        const allowedFileTypes = [
          "application/x-compressed",
          "application/x-zip-compressed",
        ];
        if (!allowedFileTypes.includes(file.headers["content-type"])) {
          return h.response({ message: "Invalid file type" }).code(400);
        }

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

      let isPractice = false;
      let isTournament = false;

      if (Practice) {
        if (Practice !== "true" && Practice !== "false") {
          return h
            .response({ message: "Invalid value for Practice" })
            .code(400);
        } else if (Practice === "true") {
          isPractice = true;
          isTournament = false;
        } else if (Practice === "true" && Tournament === "true") {
          return h
            .response({ message: "Invalid value for Practice and Tournament" })
            .code(400);
        }
      }

      if (Tournament) {
        if (Tournament !== "true" && Tournament !== "false") {
          return h
            .response({ message: "Invalid value for Tournament" })
            .code(400);
        } else if (Tournament === "true") {
          isPractice = false;
          isTournament = true;
        } else if (Tournament === "true" && Practice === "true") {
          return h
            .response({ message: "Invalid value for Practice and Tournament" })
            .code(400);
        }
      }

      const question = await Question.create(
        {
          categories_id: category.id,
          title,
          Description,
          Answer,
          point: parsedPoint,
          difficultys_id,
          file_path,
          Practice: isPractice,
          Tournament: isTournament,
          createdBy: `${decoded.first_name} ${decoded.last_name}`,
        },
        { transaction }
      );

      if (ArrayHint && ArrayHint.length > 0 && ArrayHint.length <= 3) {
        const hasInvalidHint = ArrayHint.some(
          (hint) =>
            !hint.detail ||
            hint.penalty === undefined ||
            hint.penalty === null ||
            hint.penalty < 0 ||
            isNaN(hint.penalty)
        );

        if (hasInvalidHint) {
          throw new Error(
            "Invalid hint format. Hint must have detail and penalty"
          );
        }

        const newHints = ArrayHint.map((hint) => ({
          question_id: question.id,
          Description: hint.detail,
          point: hint.penalty,
        }));

        const totalPenalty = newHints.reduce((sum, curr) => {
          const point = parseInt(curr.point, 10);
          if (isNaN(point)) {
            throw new Error(`Invalid penalty format: ${curr.point}`);
          }
          return sum + point;
        }, 0);

        if (totalPenalty > question.point) {
          throw new Error("Total penalty exceeds point");
        }

        await Hint.bulkCreate(newHints, { transaction });
      }

      // Commit the transaction since everything succeeded
      await transaction.commit();
      return h.response({ message: "Question created successfully" }).code(201);
    } catch (error) {
      // Rollback transaction if there is any error
      if (transaction) {
        await transaction.rollback();
      }
      console.error("Error creating question:", error);
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

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      const question = await Question.findByPk(questionId, {
        attributes: {
          exclude: [
            "Answer",
            "createdAt",
            "createdBy",
            "updatedAt",
            "Practice",
          ],
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

      const HintData = await Hint.findAll({
        where: { question_id: question.id },
        attributes: ["id", "Description", "point"],
        order: [["id", "DESC"]],
      });

      let hintWithUsed = [];

      if (HintData) {
        hintWithUsed = await Promise.all(
          HintData.map(async (hint) => {
            const hintUsed = await HintUsed.findOne({
              where: { hint_id: hint.id, user_id: user.user_id },
            });

            return {
              ...hint.dataValues,
              used: !!hintUsed,
            };
          })
        );
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
        hints: hintWithUsed,
      };

      return h.response(data).code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  getQuestionUser: async (request, h) => {
    try {
      const {
        page = 1,
        category,
        difficulty,
        mode,
        tournament_id,
      } = request.query;

      const parsedPage = parseInt(page, 10);

      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 12;
      const offset = (parsedPage - 1) * limit;
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

      if (difficulty) {
        if (!validDifficulties.includes(difficulty)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
        where.difficultys_id = difficulty;
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (mode) {
        if (mode === "Practice") {
          where.Practice = true;
        } else {
          return h.response({ message: "Invalid mode parameter" }).code(400);
        }
      }

      const question = await Question.findAndCountAll({
        where,
        limit: limit,
        offset: offset,
        order: [
          ["difficultys_id", "ASC"],
          ["categories_id", "ASC"],
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
        author: q.createdBy,
        solved: solvedIds.includes(q.id),
      }));

      const totalPages = Math.ceil(question.count / limit);
      const hasNextPage = parsedPage < totalPages;

      return h
        .response({
          data: mappedData,
          totalItems: question.count,
          currentPage: parsedPage,
          totalPages: totalPages,
          hasNextPage: hasNextPage,
        })
        .code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
  getAllQuestions: async (request, h) => {
    try {
      const {
        page = 1,
        category,
        difficulty,
        mode,
        tournament_id,
      } = request.query;

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid or expired token" }).code(401);
      }

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const parsedPage = parseInt(page, 10);
      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 12;
      const offset = (parsedPage - 1) * limit;
      const validDifficulties = ["Easy", "Medium", "Hard"];
      const validModes = ["Practice", "Tournament", "Unpublished"];
      let where = {};
      let question = {};
      let totalPages = 0;
      let hasNextPage = false;
      let mappedData = [];

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

      if (difficulty) {
        if (!validDifficulties.includes(difficulty)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }

        where.difficultys_id = difficulty;
      }

      if (mode) {
        if (!validModes.includes(mode)) {
          return h.response({ message: "Invalid mode parameter" }).code(400);
        } else if (mode === "Practice") {
          where.Practice = true;
          where.Tournament = false;
        } else if (mode === "Tournament") {
          const parsedTournamentId = null;
          if (tournament_id) {
            parsedTournamentId = parseInt(tournament_id, 10);
            if (isNaN(parsedTournamentId) || parsedTournamentId <= 0) {
              return h.response({ message: "Invalid tournament_id" }).code(400);
            }
          }
          where.Tournament = true;
          where.Practice = false;
          question = await QuestionTournament.findAll({
            where: parsedTournamentId
              ? { tournament_id: parsedTournamentId }
              : {},
            include: [
              {
                model: Question,
                as: "Question",
                where,
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
              },
            ],
          });

          mappedData = question.map((q) => ({
            id: q.Question.id,
            title: q.Question.title,
            point: q.Question.point,
            categories_name: q.Question.Category?.name || null,
            difficultys_id: q.Question.difficultys_id,
            author: q.Question.createdBy,
          }));

          totalPages = Math.ceil(question.count / limit);
          hasNextPage = parsedPage < totalPages;

          return h
            .response({
              data: mappedData,
              totalItems: mappedData.length,
              currentPage: parsedPage,
              totalPages: totalPages,
              hasNextPage: hasNextPage,
            })
            .code(200);
        } else if (mode === "Unpublished") {
          where.Practice = false;
          where.Tournament = false;
        }
      }

      question = await Question.findAndCountAll({
        where,
        limit: limit,
        offset: offset,
        order: [
          ["difficultys_id", "ASC"],
          ["categories_id", "ASC"],
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

      mappedData = question.rows.map((q) => ({
        id: q.id,
        title: q.title,
        point: q.point,
        categories_name: q.Category?.name || null,
        difficultys_id: q.difficultys_id,
        mode: q.Practice
          ? "Practice"
          : q.Tournament
          ? "Tournament"
          : "Unpublished",
      }));

      totalPages = Math.ceil(question.count / limit);
      hasNextPage = parsedPage < totalPages;

      return h
        .response({
          data: mappedData,
          totalItems: question.count,
          currentPage: parsedPage,
          totalPages: totalPages,
          hasNextPage: hasNextPage,
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
        file,
        Practice,
        Tournament, // array of tournament
      } = request.payload;

      if (title) {
        const existingTitle = await Question.findOne({
          where: { title, id: { [Op.ne]: questionId } },
        });
        if (existingTitle) {
          return h.response({ message: "Title already exists" }).code(409);
        }
        question.title = title;
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
        const parsedCategoriesId = parseInt(categories_id, 10);
        const category = await Category.findOne({
          where: { id: parsedCategoriesId },
          attributes: ["id"],
        });
        if (!category) {
          return h.response({ message: "Category not found" }).code(404);
        }
        question.categories_id = category.id;
      }

      if (difficultys_id) {
        const validDifficulties = ["Easy", "Medium", "Hard"];
        if (!validDifficulties.includes(difficultys_id)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
        question.difficultys_id = difficultys_id;
      }

      if (Description) question.Description = Description;
      if (Answer) question.Answer = Answer;
      if (point) {
        const parsedPoint = parseInt(point, 10);
        if (isNaN(parsedPoint) || parsedPoint <= 0) {
          return h.response({ message: "Invalid point" }).code(400);
        }
        question.point = parsedPoint;
      }

      if (Practice !== "true" && Practice !== "false") {
        return h.response({ message: "Invalid value for Practice" }).code(400);
      }

      let isPractice = Practice === "true";

      if (isPractice === true) {
        await QuestionTournament.destroy({
          where: { questions_id: question.id },
          transaction,
        });
        question.Practice = true;
      } else if (isPractice === false) {
        const ArrayTournament = JSON.parse(Tournament);

        if (ArrayTournament && ArrayTournament.length > 0) {
          await QuestionTournament.destroy({
            where: { questions_id: question.id },
            transaction,
          });

          const validTournament = await Tournaments.findAll({
            where: { name: { [Op.in]: Tournament } },
            attributes: ["id"],
            transaction,
          });

          if (validTournament.length !== Tournament.length) {
            return h
              .response({ message: "Some tournaments are invalid" })
              .code(400);
          }

          question.Practice = false;

          const newQuestionTournament = validTournament.map((tournament) => ({
            questions_id: question.id,
            tournament_id: tournament.id,
          }));

          await QuestionTournament.bulkCreate(newQuestionTournament, {
            transaction,
          });
        }
      }

      question.file_path = file_path;

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

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      } catch (err) {
        return h.response({ message: "Invalid token" }).code(401);
      }

      const user = await User.findOne(
        {
          where: { itaccount: decoded.email },
        },
        { transaction }
      );

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const question = await Question.findByPk(questionId, { transaction });
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

      const existingHints = await Hint.findAll({
        where: { question_id: question.id },
        transaction,
      });

      if (existingHints.length > 0) {
        await Hint.destroy({
          where: { question_id: question.id },
          transaction,
        });
      }

      const existingHintUsed = await HintUsed.findAll({
        where: { hint_id: { [Op.in]: existingHints.map((item) => item.id) } },
        transaction,
      });

      if (existingHintUsed.length > 0) {
        const UserIds = existingHintUsed.map((item) => item.user_id);
        await Point.update(
          { points: sequelize.literal("points + " + item.point) },
          { where: { users_id: { [Op.in]: UserIds } }, transaction }
        );
        await HintUsed.destroy({
          where: { hint_id: { [Op.in]: existingHints.map((item) => item.id) } },
          transaction,
        });
      }

      const existingSubmited = await Submited.findAll({
        where: { question_id: question.id },
        transaction,
      });

      if (existingSubmited.length > 0) {
        const UserIds = existingSubmited.map((item) => item.users_id);
        await Point.update(
          { points: sequelize.literal("points - " + question.point) },
          { where: { users_id: { [Op.in]: UserIds } }, transaction }
        );

        await Submited.destroy({
          where: { question_id: question.id },
          transaction,
        });
      }

      await question.destroy({ transaction });

      await transaction.commit();
      return h.response({ message: "Question has been deleted" }).code(200);
    } catch (error) {
      await transaction.rollback();
      console.log(error.message);
      return h.response({ message: error.message }).code(500);
    }
  },
  checkAnswerPractice: async (request, h) => {
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
            itaccount: decoded.email,
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
          return h
            .response({ message: "Already submitted", solve: true })
            .code(200);
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
  checkAnswerTournament: async (request, h) => {
    try {
      const { question_id, tournament_id, Answer, team_id } = request.payload;

      const question = await QuestionTournament.findOne({
        where: { questions_id: question_id, tournament_id },
        include: [
          {
            model: Question,
            as: "Question",
            attributes: ["Answer"],
          },
        ],
      });

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

      const user = await User.findOne({
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const answer = "CTFCQ{" + question.Question.Answer + "}";
      if (answer === Answer) {
        let point = await TournamentPoints.findOne({
          where: { users_id: user.user_id, tournament_id },
        });

        if (!point) {
          return h.response({ message: "Point not found" }).code(404);
        }

        const existingSubmission = await TournamentSubmited.findOne({
          where: {
            question_tournament_id: question.id,
            team_id,
          },
        });

        if (existingSubmission) {
          return h.response({ message: "Already submitted" }).code(200);
        }

        await TournamentSubmited.create({
          users_id: user.user_id,
          question_tournament_id: question.id,
          tournament_id,
          team_id,
        });

        point.points += question.Question.point;

        await point.save();

        let teamScore = await TeamScores.findOne({
          where: { team_id: team_id, tournament_id },
        });

        if (!teamScore) {
          return h.response({ message: "Team score not found" }).code(404);
        }

        teamScore.total_points += question.Question.point;
        await teamScore.save();

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
  UseHint: async (request, h) => {
    try {
      const HintId = parseInt(request.params.id, 10);
      if (isNaN(HintId)) {
        return h.response({ message: "Invalid hint ID" }).code(400);
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
        where: {
          itaccount: decoded.email,
        },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const hint = await Hint.findOne({
        where: { id: HintId },
      });

      if (!hint) {
        return h.response({ message: "Hint not found" }).code(404);
      }

      const existingHintUsed = await HintUsed.findOne({
        where: { hint_id: hint.id, user_id: user.user_id },
      });

      if (existingHintUsed) {
        return h
          .response({ message: "Hint already used", data: hint.Description })
          .code(200);
      }

      const point = await Point.findOne({
        where: { users_id: user.user_id },
      });

      if (!point) {
        return h.response({ message: "Point not found" }).code(404);
      }

      if (point.points < hint.point) {
        return h.response({ message: "Not enough points" }).code(400);
      }

      point.points -= hint.point;
      await point.save();

      await HintUsed.create({
        hint_id: hint.id,
        user_id: user.user_id,
      });

      return h
        .response({ message: "Hint used", data: hint.Description })
        .code(200);
    } catch (error) {
      return h.response({ message: error.message }).code(500);
    }
  },
};

module.exports = questionController;
