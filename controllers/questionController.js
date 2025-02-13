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
const Team = db.Team;
const User_Team = db.Users_Team;
const crypto = require("crypto");
const moment = require("moment-timezone");
const xss = require("xss");

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
      if (isNaN(parsedCategoriesId) || parsedCategoriesId <= 0) {
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

      const trimmedTitle = title.trim();
      const trimmedAnswer = Answer.trim();
      if (trimmedTitle.length < 1) {
        return h.response({ message: "Title cannot be empty" }).code(400);
      }

      if (trimmedAnswer.length < 1) {
        return h.response({ message: "Answer cannot be empty" }).code(400);
      }

      const secretKey = process.env.ANSWER_SECRET_KEY;
      if (!secretKey) {
        return h.response({ message: "Server configuration error" }).code(500);
      }

      let encryptedAnswer;
      try {
        encryptedAnswer = await encryptData(trimmedAnswer, secretKey);
      } catch (error) {
        return h.response({ message: "Failed to encrypt answer" }).code(500);
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

      const sanitizedTitle = xss(trimmedTitle);
      const sanitizedDescription = xss(Description);

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
        where: { title: trimmedTitle },
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
      if (file?.filename) {
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
        }
      }

      const question = await Question.create(
        {
          categories_id: category.id,
          title: sanitizedTitle,
          Description: sanitizedDescription,
          Answer: encryptedAnswer,
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

        const sanitizedHintDetail = ArrayHint.map((hint) => ({
          question_id: question.id,
          Description: xss(hint.detail),
          point: hint.penalty,
        }));

        const totalPenalty = sanitizedHintDetail.reduce((sum, curr) => {
          const point = parseInt(curr.point, 10);
          if (isNaN(point) || point < 0) {
            throw new Error(`Invalid penalty format: ${curr.point}`);
          }
          return sum + point;
        }, 0);

        if (totalPenalty > question.point) {
          throw new Error("Total penalty exceeds point");
        }

        await Hint.bulkCreate(sanitizedHintDetail, { transaction });
      }

      await transaction.commit();
      return h.response({ message: "Question created successfully" }).code(201);
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error("Error creating question:", error);
      return h.response({ message: error.message }).code(500);
    }
  },

  addQuestionToTournament: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const { question_id, tournament_id } = request.payload;

      if (!Array.isArray(question_id)) {
        return h
          .response({ message: "question_id must be an array" })
          .code(400);
      }

      if (
        question_id.length === 0 ||
        !question_id.every((id) => {
          const parsedId = parseInt(id, 10);
          return !isNaN(parsedId) && parsedId > 0;
        })
      ) {
        return h
          .response({
            message: "Missing or invalid items in question_id array",
          })
          .code(400);
      }

      const parsedTournamentId = parseInt(tournament_id, 10);
      if (isNaN(parsedTournamentId) || parsedTournamentId <= 0) {
        return h.response({ message: "Invalid tournament_id" }).code(400);
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

      const tournament = await Tournaments.findByPk(parsedTournamentId, {
        transaction,
      });

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      const questions = await Question.findAll({
        where: { id: { [Op.in]: question_id } },
        transaction,
      });

      if (questions.length !== question_id.length) {
        return h.response({ message: "Some questions not found" }).code(404);
      }

      const existingAssociations = await QuestionTournament.findAll({
        where: {
          tournament_id: parsedTournamentId,
          questions_id: { [Op.in]: question_id },
        },
        transaction,
      });

      const existingQuestionIds = new Set(
        existingAssociations.map((assoc) => assoc.questions_id)
      );

      const newQuestions = questions
        .filter((question) => !existingQuestionIds.has(question.id))
        .map((question) => ({
          tournament_id: parsedTournamentId,
          questions_id: question.id,
        }));

      if (newQuestions.length > 0) {
        await QuestionTournament.bulkCreate(newQuestions, { transaction });
      }

      await transaction.commit();
      return h
        .response({ message: "Questions added to tournament successfully" })
        .code(201);
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error("Error adding question to tournament:", error);
      return h.response({ message: error.message }).code(500);
    }
  },
  deleteQuestionFromTournament: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const { tournamentId, questionIds } = request.params;
      if (!questionIds) {
        return h.response({ message: "Missing question_id" }).code(400);
      }

      if (!tournamentId) {
        return h.response({ message: "Missing tournament_id" }).code(400);
      }

      const parsedQuestionId = parseInt(questionIds, 10);
      if (isNaN(parsedQuestionId) || parsedQuestionId <= 0) {
        return h.response({ message: "Invalid question_id" }).code(400);
      }

      const parsedTournamentId = parseInt(tournamentId, 10);
      if (isNaN(parsedTournamentId) || parsedTournamentId <= 0) {
        return h.response({ message: "Invalid tournament_id" }).code(400);
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

      const tournament = await Tournaments.findByPk(parsedTournamentId, {
        transaction,
      });

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      const questions = await QuestionTournament.findOne({
        where: {
          questions_id: parsedQuestionId,
          tournament_id: parsedTournamentId,
        },
        transaction,
      });

      if (!questions || questions.length === 0) {
        return h.response({ message: "Question not found" }).code(404);
      }

      const existingSubmission = await TournamentSubmited.findOne({
        where: {
          question_tournament_id: questions.id,
          tournament_id: parsedTournamentId,
        },
        transaction,
      });

      if (existingSubmission) {
        return h
          .response({
            message: "Cannot delete question that has been submitted",
          })
          .code(400);
      }

      await QuestionTournament.destroy({
        where: {
          questions_id: parsedQuestionId,
          tournament_id: parsedTournamentId,
        },
        transaction,
      });

      await transaction.commit();
      return h
        .response({ message: "Question removed from tournament" })
        .code(200);
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error("Error deleting question from tournament:", error);
      return h.response({ message: error.message }).code(500);
    }
  },

  getQuestionById: async (request, h) => {
    try {
      const questionId = parseInt(request.params.id, 10);
      if (isNaN(questionId) || questionId <= 0) {
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

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const question = await Question.findByPk(questionId, {
        attributes: {
          exclude:
            user.role === "Admin"
              ? ["createdAt", "updatedAt"]
              : ["Answer", "createdAt", "updatedAt", "Practice", "Tournament"],
        },
        include: [
          {
            model: Category,
            as: "Category",
            attributes: ["name", "id"],
          },
        ],
      });

      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      const HintData = await Hint.findAll({
        where: { question_id: question.id },
        attributes: ["id", "Description", "point"],
        order: [["id", "ASC"]],
      });

      let hintWithUsed = [];
      let data = {};

      if (HintData) {
        hintWithUsed = await Promise.all(
          HintData.map(async (hint) => {
            const hintUsed = await HintUsed.findOne({
              where: { hint_id: hint.id, user_id: user.user_id },
            });

            return {
              id: hint.id,
              point: hint.point,
              used: !!hintUsed,
            };
          })
        );
      }

      const isSolved = await Submited.findOne({
        where: { users_id: user.user_id, question_id: question.id },
      });

      if (user.role === "Admin") {
        const secretKey = process.env.ANSWER_SECRET_KEY;

        const decryptedAnswer = await decryptData(question.Answer, secretKey);
        data = {
          id: question.id,
          title: question.title,
          description: question.Description,
          point: question.point,
          categories_id: question.Category?.id,
          categories_name: question.Category?.name,
          difficultys_id: question.difficultys_id,
          file_path: question.file_path,
          answer: decryptedAnswer,
          author: question.createdBy,
          hints: HintData,
          mode: (() => {
            if (question.Practice) return "Practice";
            if (question.Tournament) return "Tournament";
            return "Unpublished";
          })(),
        };

        return h.response(data).code(200);
      }

      const existingTournament = await QuestionTournament.findOne({
        where: { questions_id: question.id },
      });

      if (existingTournament) {
        const validTime = await Tournaments.findOne({
          where: { id: existingTournament.tournament_id },
        });

        const currentTime = moment.tz("Asia/Bangkok").utc().toDate();

        if (currentTime > validTime.event_endDate) {
          return h.response({ message: "Tournament has ended" }).code(400);
        }

        if (currentTime < validTime.event_startDate) {
          return h
            .response({ message: "Tournament has not started" })
            .code(400);
        }
      }

      data = {
        id: question.id,
        title: question.title,
        description: question.Description,
        point: question.point,
        categories_name: question.Category?.name,
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

      const parsedPage = parseInt(page, 10);

      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 12;
      const offset = (parsedPage - 1) * limit;
      const validDifficulties = ["Easy", "Medium", "Hard"];
      const validModes = ["Practice", "Tournament"];
      let where = {};
      let question = {};
      let totalPages = 0;
      let hasNextPage = false;
      let mappedData = [];
      let TournamentSovledIds = [];
      let submitCountMap = {};

      if (category) {
        const categoryNames = category.split(",").map((cat) => cat.trim());

        const categories = await Category.findAll({
          where: { name: { [Op.in]: categoryNames } },
          attributes: ["id", "name"],
        });

        const foundCategoryNames = categories.map((cat) => cat.name);

        const notFoundCategories = categoryNames.filter(
          (cat) => !foundCategoryNames.includes(cat)
        );

        if (notFoundCategories.length > 0) {
          return h
            .response({
              message: `Categories not found: ${notFoundCategories.join(", ")}`,
            })
            .code(404);
        }

        const categoryIds = categories.map((cat) => cat.id);
        where.categories_id = { [Op.in]: categoryIds };
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
          if (!tournament_id) {
            return h
              .response({
                message: "Missing tournament_id",
              })
              .code(400);
          } else if (tournament_id) {
            const parsedTournamentId = parseInt(tournament_id, 10);
            if (isNaN(parsedTournamentId) || parsedTournamentId <= 0) {
              return h.response({ message: "Invalid tournament_id" }).code(400);
            }

            const validTime = await Tournaments.findOne({
              where: { id: parsedTournamentId },
            });

            const currentTime = moment.tz("Asia/Bangkok").utc().toDate();

            if (currentTime > validTime.event_endDate) {
              return h.response({ message: "Tournament has ended" }).code(400);
            }

            if (currentTime < validTime.event_startDate) {
              return h
                .response({ message: "Tournament has not started" })
                .code(400);
            }

            let Userteam = null;

            if (user.role !== "Admin") {
              Userteam = await User_Team.findOne({
                where: { users_id: user.user_id },
                include: [
                  {
                    model: Team,
                    as: "team",
                    attributes: ["id", "tournament_id", "name"],
                    where: { tournament_id: parsedTournamentId },
                  },
                ],
              });
              if (!Userteam) {
                return h
                  .response({ message: "User not in this tournament" })
                  .code(404);
              }

              const TournamentSovled = await TournamentSubmited.findAll({
                where: { team_id: Userteam.team_id },
                include: [
                  {
                    model: QuestionTournament,
                    as: "QuestionTournament",
                    attributes: ["questions_id"],
                  },
                ],
              });

              TournamentSovledIds = TournamentSovled.map(
                (item) => item.QuestionTournament.questions_id
              );
            }

            where.Tournament = true;
            where.Practice = false;
            question = await QuestionTournament.findAndCountAll({
              where: { tournament_id: parsedTournamentId },
              limit: limit,
              offset: offset,
              order: [
                [{ model: Question, as: "Question" }, "difficultys_id", "ASC"],
                [{ model: Question, as: "Question" }, "categories_id", "ASC"],
                [{ model: Question, as: "Question" }, "id", "ASC"],
              ],
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

            const submitCounts = await TournamentSubmited.findAll({
              attributes: [
                "question_tournament_id",
                [sequelize.fn("COUNT", sequelize.col("id")), "submitCount"],
              ],
              where: { tournament_id: parsedTournamentId },
              group: ["question_tournament_id"],
              raw: true,
            });

            submitCountMap = submitCounts.reduce((acc, curr) => {
              acc[curr.question_tournament_id] = curr.submitCount;
              return acc;
            }, {});

            mappedData = question.rows.map((qt) => {
              const q = qt.Question || qt;
              return {
                id: q.id,
                title: q.title,
                point: q.point,
                categories_name: q.Category?.name,
                difficultys_id: q.difficultys_id,
                solved: TournamentSovledIds.includes(q.id),
                submitCount: submitCountMap[q.id] || 0,
              };
            });

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
          }
        }
      } else {
        return h.response({ message: "Invalid mode parameter" }).code(400);
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

      const solvedQuestions = await Submited.findAll({
        where: { users_id: user.user_id },
        attributes: ["question_id"],
      });

      const solvedIds = solvedQuestions.map((item) => item.question_id);

      const submitCounts = await Submited.findAll({
        attributes: [
          "question_id",
          [sequelize.fn("COUNT", sequelize.col("id")), "submitCount"],
        ],
        group: ["question_id"],
        raw: true,
      });

      submitCountMap = submitCounts.reduce((acc, curr) => {
        acc[curr.question_id] = curr.submitCount;
        return acc;
      }, {});

      mappedData = question.rows.map((q) => ({
        id: q.id,
        title: q.title,
        point: q.point,
        categories_name: q.Category?.name,
        difficultys_id: q.difficultys_id,
        author: q.createdBy,
        solved: solvedIds.includes(q.id),
        submitCount: submitCountMap[q.id] || 0,
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

  getAllQuestions: async (request, h) => {
    try {
      const {
        page = 1,
        category,
        difficulty,
        mode,
        tournament_id,
        tournament_selected,
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
      let submitCountMap = {};

      if (category) {
        const categoryNames = category.split(",").map((cat) => cat.trim());

        const categories = await Category.findAll({
          where: { name: { [Op.in]: categoryNames } },
          attributes: ["id", "name"],
        });

        const foundCategoryNames = categories.map((cat) => cat.name);

        const notFoundCategories = categoryNames.filter(
          (cat) => !foundCategoryNames.includes(cat)
        );

        if (notFoundCategories.length > 0) {
          return h
            .response({
              message: `Categories not found: ${notFoundCategories.join(", ")}`,
            })
            .code(404);
        }

        const categoryIds = categories.map((cat) => cat.id);
        where.categories_id = { [Op.in]: categoryIds };
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
          let parsedTournamentId = null;
          let parsedTournamentSelected = null;
          let questionIds = [];

          try {
            if (tournament_id && tournament_selected) {
              return h
                .response({ message: "Invalid query parameter" })
                .code(400);
            } else if (tournament_id) {
              parsedTournamentId = parseInt(tournament_id, 10);
              if (isNaN(parsedTournamentId) || parsedTournamentId <= 0) {
                return h
                  .response({ message: "Invalid tournament_id" })
                  .code(400);
              }

              question = await QuestionTournament.findAndCountAll({
                where: { tournament_id: parsedTournamentId },
                limit: limit,
                offset: offset,
                order: [
                  [
                    { model: Question, as: "Question" },
                    "difficultys_id",
                    "ASC",
                  ],
                  [{ model: Question, as: "Question" }, "categories_id", "ASC"],
                  [{ model: Question, as: "Question" }, "id", "ASC"],
                ],
                include: [
                  {
                    model: Question,
                    as: "Question",
                    where,
                    attributes: {
                      exclude: [
                        "Answer",
                        "createdAt",
                        "createdBy",
                        "updatedAt",
                      ],
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

              const submitCounts = await TournamentSubmited.findAll({
                attributes: [
                  "question_tournament_id",
                  [sequelize.fn("COUNT", sequelize.col("id")), "submitCount"],
                ],
                where: { tournament_id: parsedTournamentId },
                group: ["question_tournament_id"],
                raw: true,
              });

              submitCountMap = submitCounts.reduce((acc, curr) => {
                acc[curr.question_tournament_id] = curr.submitCount;
                return acc;
              }, {});
            } else {
              if (tournament_selected) {
                parsedTournamentSelected = parseInt(tournament_selected, 10);
                if (
                  isNaN(parsedTournamentSelected) ||
                  parsedTournamentSelected <= 0
                ) {
                  return h
                    .response({ message: "Invalid tournament_selected" })
                    .code(400);
                }

                const existingQuestionIds = await QuestionTournament.findAll({
                  where: { tournament_id: parsedTournamentSelected },
                  attributes: ["questions_id"],
                });

                questionIds = existingQuestionIds.map(
                  (item) => item.questions_id
                );
              } else {
                const existingQuestionIds = await QuestionTournament.findAll({
                  attributes: ["questions_id"],
                  distinct: true,
                });

                questionIds = existingQuestionIds.map(
                  (item) => item.questions_id
                );
              }

              question = await Question.findAndCountAll({
                where: {
                  ...where,
                  Tournament: true,
                  Practice: false,
                },
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

              const submitCounts = await TournamentSubmited.findAll({
                attributes: [
                  "question_tournament_id",
                  [sequelize.fn("COUNT", sequelize.col("id")), "submitCount"],
                ],
                group: ["question_tournament_id"],

                raw: true,
              });

              submitCountMap = submitCounts.reduce((acc, curr) => {
                acc[curr.question_tournament_id] = curr.submitCount;
                return acc;
              }, {});
            }

            mappedData = question.rows.map((qt) => {
              const q = qt.Question || qt;
              return {
                id: q.id,
                title: q.title,
                point: q.point,
                categories_name: q.Category?.name,
                difficultys_id: q.difficultys_id,
                author: q.createdBy,
                mode: "Tournament",
                is_selected: questionIds.includes(q.id),
                submitCount: submitCountMap[q.id] || 0,
              };
            });

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
          } catch (error) {
            return h.response({ message: error.message }).code(500);
          }
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

      const submitCounts = await Submited.findAll({
        attributes: [
          "question_id",
          [sequelize.fn("COUNT", sequelize.col("id")), "submitCount"],
        ],
        group: ["question_id"],
        raw: true,
      });

      submitCountMap = submitCounts.reduce((acc, curr) => {
        acc[curr.question_id] = curr.submitCount;
        return acc;
      }, {});

      const submitCountTournament = await TournamentSubmited.findAll({
        attributes: [
          "question_tournament_id",
          [sequelize.fn("COUNT", sequelize.col("id")), "submitCount"],
        ],

        group: ["question_tournament_id"],
        raw: true,
      });

      const submitCountMapTournament = submitCountTournament.reduce(
        (acc, curr) => {
          acc[curr.question_tournament_id] = curr.submitCount;
          return acc;
        },
        {}
      );

      const existingTournament = await QuestionTournament.findAll({
        attributes: ["questions_id"],
        distinct: true,
      });

      const questionIds = existingTournament.map((item) => item.questions_id);

      mappedData = question.rows.map((q) => {
        let mode = "Unpublished";
        let submitCount = 0;
        let is_selected = false;

        if (q.Tournament) {
          submitCount = submitCountMapTournament[q.id] || 0;
          mode = "Tournament";
          is_selected = questionIds.includes(q.id);
        } else if (q.Practice) {
          submitCount = submitCountMap[q.id] || 0;
          mode = "Practice";
        }
        return {
          id: q.id,
          title: q.title,
          point: q.point,
          categories_name: q.Category?.name || null,
          difficultys_id: q.difficultys_id,
          mode: mode,
          submitCount: submitCount,
          is_selected: is_selected,
        };
      });

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
      if (isNaN(questionId) || questionId <= 0) {
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
        where: { itaccount: decoded.email },
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Unauthorized" }).code(401);
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
        Tournament,
        Hints,
        isFileEdited,
      } = request.payload;

      let ArrayHint;
      try {
        ArrayHint = JSON.parse(Hints);
      } catch (error) {
        return h.response({ message: "Invalid Hints format" }).code(400);
      }

      const question = await Question.findByPk(questionId);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      if (isFileEdited !== "true" && isFileEdited !== "false") {
        return h
          .response({ message: "Invalid value for isFileEdited" })
          .code(400);
      }

      const existingSubmission = await Submited.findOne({
        where: { question_id: questionId },
      });
      if (existingSubmission) {
        return h
          .response({ message: "Question has been submitted, cannot update" })
          .code(400);
      }

      const existingTournamentSubmited = await TournamentSubmited.findOne({
        attributes: ["id"],
        include: [
          {
            model: QuestionTournament,
            where: { questions_id: questionId },
          },
        ],
      });

      if (existingTournamentSubmited) {
        return h
          .response({
            message: "Question has been submitted in tournament, cannot update",
          })
          .code(400);
      }

      const existingHint = await Hint.findAll({
        where: { question_id: questionId },
      });
      if (existingHint.length > 0) {
        const existingHintUsed = await HintUsed.findAll({
          where: { hint_id: { [Op.in]: existingHint.map((item) => item.id) } },
        });
        if (existingHintUsed.length > 0) {
          return h
            .response({ message: "Question has been used hint, cannot update" })
            .code(400);
        }
      }

      const existingTournament = await QuestionTournament.findOne({
        where: { questions_id: questionId },
      });
      if (existingTournament) {
        return h
          .response({ message: "Question in tournament cannot be updated" })
          .code(400);
      }

      if (title) {
        const trimmedTitle = title.trim();
        const existingTitle = await Question.findOne({
          where: { title: trimmedTitle, id: { [Op.ne]: questionId } },
        });
        if (existingTitle) {
          return h.response({ message: "Title already exists" }).code(409);
        }

        const sanitizedTitle = xss(trimmedTitle);
        question.title = sanitizedTitle;
      }

      let file_path = question.file_path;

      if (file?.filename) {
        const existingFile = await Question.findOne({
          where: { file_path: file.filename, id: { [Op.ne]: questionId } },
        });
        if (existingFile) {
          return h.response({ message: "File already exists" }).code(409);
        }
      } else if (isFileEdited === "true") {
        if (question.file_path) {
          try {
            fs.unlinkSync(
              path.join(__dirname, "..", "uploads", question.file_path)
            );
          } catch (err) {
            console.warn("Failed to delete old file:", err);
          }
        }
        file_path = null;
      }

      if (file?.filename && file?.path) {
        const allowedFileTypes = [
          "application/x-compressed",
          "application/x-zip-compressed",
        ];
        if (!allowedFileTypes.includes(file.headers["content-type"])) {
          return h.response({ message: "Invalid file type" }).code(400);
        }

        if (question.file_path) {
          try {
            fs.unlinkSync(
              path.join(__dirname, "..", "uploads", question.file_path)
            );
          } catch (err) {
            console.warn("Failed to delete old file:", err);
          }
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

      if (Description) {
        const sanitizedDescription = xss(Description);
        question.Description = sanitizedDescription;
      }
      if (Answer) {
        const trimmedAnswer = Answer.trim();
        const secretKey = process.env.ANSWER_SECRET_KEY;
        const encryptedAnswer = await encryptData(trimmedAnswer, secretKey);
        question.Answer = encryptedAnswer;
      }

      if (point) {
        const parsedPoint = parseInt(point, 10);
        if (isNaN(parsedPoint) || parsedPoint <= 0) {
          return h.response({ message: "Invalid point" }).code(400);
        }
        question.point = parsedPoint;
      }

      if (ArrayHint !== undefined) {
        await Hint.destroy({
          where: { question_id: question.id },
          transaction,
        });

        if (ArrayHint.length > 0) {
          if (ArrayHint.length > 3) {
            throw new Error("Maximum 3 hints allowed");
          }

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

          const sanitizedHint = ArrayHint.map((hint) => ({
            question_id: question.id,
            Description: xss(hint.detail),
            point: hint.penalty,
          }));

          const totalPenalty = sanitizedHint.reduce((sum, curr) => {
            const point = parseInt(curr.point, 10);
            if (isNaN(point) || point < 0) {
              throw new Error(`Invalid penalty format: ${curr.point}`);
            }
            return sum + point;
          }, 0);

          if (totalPenalty > question.point) {
            throw new Error("Total penalty exceeds point");
          }

          await Hint.bulkCreate(sanitizedHint, { transaction });
        }
      }

      question.Practice = false;
      question.Tournament = false;

      if (Practice) {
        if (Practice !== "true" && Practice !== "false") {
          return h
            .response({ message: "Invalid value for Practice" })
            .code(400);
        } else if (Practice === "true") {
          question.Practice = true;
        }
      }

      if (Tournament) {
        if (Tournament !== "true" && Tournament !== "false") {
          return h
            .response({ message: "Invalid value for Tournament" })
            .code(400);
        } else if (Tournament === "true") {
          question.Tournament = true;
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
      if (isNaN(questionId) || questionId <= 0) {
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

      const existingHintUsed = await HintUsed.findAll({
        where: { hint_id: { [Op.in]: existingHints.map((item) => item.id) } },
        transaction,
      });

      if (existingHintUsed.length > 0) {
        const UserIds = existingHintUsed.map((item) => item.user_id);
        const pointsToUpdate = existingHints.reduce(
          (sum, curr) => sum + curr.point,
          0
        );
        await Point.update(
          { points: sequelize.literal(`points +  ${pointsToUpdate}`) },
          { where: { users_id: { [Op.in]: UserIds } }, transaction }
        );
        await HintUsed.destroy({
          where: { hint_id: { [Op.in]: existingHints.map((item) => item.id) } },
          transaction,
        });
      }

      if (existingHints.length > 0) {
        await Hint.destroy({
          where: { question_id: question.id },
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

      const existingTournament = await QuestionTournament.findOne({
        where: { questions_id: question.id },
        transaction,
      });

      if (existingTournament) {
        const existingTournamentSubmited = await TournamentSubmited.findAll({
          where: { question_tournament_id: existingTournament.id },
          transaction,
        });

        if (existingTournamentSubmited.length > 0) {
          const TeamIds = existingTournamentSubmited.map(
            (item) => item.team_id
          );

          const UserIds = existingTournamentSubmited.map(
            (item) => item.users_id
          );
          await TeamScores.update(
            {
              total_points: sequelize.literal(
                "total_points - " + question.point
              ),
            },
            {
              where: {
                team_id: { [Op.in]: TeamIds },
                tournament_id: existingTournament.tournament_id,
              },
              transaction,
            }
          );
          await TournamentPoints.update(
            { points: sequelize.literal("points - " + question.point) },
            { where: { users_id: { [Op.in]: UserIds } }, transaction }
          );

          await TournamentSubmited.destroy({
            where: { question_tournament_id: existingTournament.id },
            transaction,
          });
        }

        await QuestionTournament.destroy({
          where: { questions_id: question.id },
          transaction,
        });
      }

      await question.destroy({ transaction });

      await transaction.commit();
      return h.response({ message: "Question has been deleted" }).code(200);
    } catch (error) {
      await transaction.rollback();
      console.log("Error in deleteQuestion:", error.message);

      return h.response({ message: error.message }).code(500);
    }
  },
  checkAnswerPractice: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const { Answer, id } = request.payload;

      const parsedId = parseInt(id, 10);
      if (isNaN(parsedId) || parsedId <= 0) {
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const question = await Question.findByPk(parsedId, { transaction });
      if (!question) {
        await transaction.rollback();
        return h.response({ message: "Question not found" }).code(404);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        await transaction.rollback();
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) {
        await transaction.rollback();
        return h.response({ message: "Invalid token" }).code(401);
      }

      const existingTournament = await QuestionTournament.findOne({
        where: { questions_id: parsedId },
        transaction,
      });

      if (existingTournament) {
        return h
          .response({ message: "Cannot submit tournament question" })
          .code(400);
      }

      const secretKeyForAnswer = process.env.ANSWER_SECRET_KEY;
      const decryptedAnswer = await decryptData(
        question.Answer,
        secretKeyForAnswer
      );

      const correctAnswer = `CTFCQ{${decryptedAnswer}}`;

      if (correctAnswer === Answer) {
        const user = await User.findOne({
          where: {
            itaccount: decoded.email,
          },
          transaction,
        });

        if (!user) {
          await transaction.rollback();
          return h.response({ message: "User not found" }).code(404);
        }

        let point = await Point.findOne({
          where: { users_id: user.user_id },
          transaction,
        });

        if (!point) {
          await transaction.rollback();
          return h.response({ message: "Point not found" }).code(404);
        }

        const existingSubmission = await Submited.findOne({
          where: {
            users_id: user.user_id,
            question_id: question.id,
          },
          transaction,
        });

        if (existingSubmission) {
          await transaction.rollback();
          return h
            .response({ message: "Already submitted", solve: true })
            .code(200);
        }

        await Submited.create(
          {
            users_id: user.user_id,
            question_id: question.id,
          },
          { transaction }
        );

        point.points += question.point;
        await point.save({ transaction });

        await transaction.commit();
        return h.response({ message: "Correct", solve: true }).code(200);
      } else {
        await transaction.rollback();
        return h.response({ message: "Incorrect", solve: false }).code(200);
      }
    } catch (err) {
      console.error(err);
      await transaction.rollback();
      return h.response({ message: "Internal Server Error" }).code(500);
    }
  },

  checkAnswerTournament: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const { question_id, tournament_id, Answer } = request.payload;

      const parsedId = parseInt(question_id, 10);
      if (isNaN(parsedId) || parsedId <= 0) {
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const tournamentId = parseInt(tournament_id, 10);
      if (isNaN(tournamentId) || tournamentId <= 0) {
        return h.response({ message: "Invalid tournament ID" }).code(400);
      }

      const question = await QuestionTournament.findOne({
        where: { questions_id: parsedId, tournament_id: tournamentId },
        include: [
          {
            model: Question,
            as: "Question",
            attributes: ["Answer", "point"],
          },
        ],
        transaction,
      });

      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      if (question.Question.Practice) {
        return h
          .response({ message: "Cannot submit practice question" })
          .code(400);
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
        transaction,
      });

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const secretKeyForAnswer = process.env.ANSWER_SECRET_KEY;
      const correctAnswer = await decryptData(
        question.Question.Answer,
        secretKeyForAnswer
      );

      if (Answer === correctAnswer) {
        if (user.role === "Admin") {
          await transaction.commit();
          return h.response({ message: "Correct", solve: true }).code(200);
        }

        const UserTeam = await User_Team.findOne({
          where: { users_id: user.user_id },
          include: [
            {
              model: Team,
              as: "team",
              attributes: ["id", "tournament_id", "name"],
              where: { tournament_id: tournamentId },
            },
          ],
          transaction,
        });

        if (!UserTeam) {
          return h
            .response({ message: "User not in this tournament" })
            .code(404);
        }

        let point = await TournamentPoints.findOne({
          where: { users_id: UserTeam.users_id, tournament_id: tournamentId },
          transaction,
        });

        if (!point) {
          return h.response({ message: "Point not found" }).code(404);
        }

        const existingSubmission = await TournamentSubmited.findOne({
          where: {
            question_tournament_id: question.id,
            team_id: UserTeam.team_id,
          },
          transaction,
        });

        if (existingSubmission) {
          return h
            .response({ message: "Already submitted", solve: true })
            .code(200);
        }

        await TournamentSubmited.create(
          {
            users_id: UserTeam.users_id,
            question_tournament_id: question.id,
            tournament_id: tournamentId,
            team_id: UserTeam.team_id,
          },
          { transaction }
        );

        point.points += question.Question.point;
        await point.save({ transaction });

        let teamScore = await TeamScores.findOne({
          where: { team_id: UserTeam.team_id, tournament_id: tournamentId },
          transaction,
        });

        if (!teamScore) {
          return h.response({ message: "Team score not found" }).code(404);
        }

        teamScore.total_points += question.Question.point;
        await teamScore.save({ transaction });

        await transaction.commit();
        return h.response({ message: "Correct", solve: true }).code(200);
      } else {
        return h.response({ message: "Incorrect", solve: false }).code(200);
      }
    } catch (err) {
      console.error(err);
      await transaction.rollback();
      return h.response({ message: "Internal Server Error" }).code(500);
    }
  },
  downloadFile: async (request, h) => {
    try {
      const questionId = parseInt(request.params.id, 10);
      if (isNaN(questionId) || questionId <= 0) {
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
      return h.response({ message: error.message }).code(500);
    }
  },
  UseHint: async (request, h) => {
    try {
      const HintId = parseInt(request.params.id, 10);
      if (isNaN(HintId) || HintId <= 0) {
        return h.response({ message: "Invalid hint ID" }).code(400);
      }

      const hint = await Hint.findOne({
        where: { id: HintId },
      });

      if (!hint) {
        return h.response({ message: "Hint not found" }).code(404);
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

      if (user.role === "Admin") {
        return h.response({ data: hint.Description }).code(200);
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

async function encryptData(text, secretKey) {
  const key = await getHashedKey(secretKey);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString(
    "hex"
  )}`;
}

async function decryptData(encryptedString, secretKey) {
  const textParts = encryptedString.split(":");

  const iv = Buffer.from(textParts.shift(), "hex");

  const encryptedText = Buffer.from(textParts.shift(), "hex");

  const authTag = Buffer.from(textParts.shift(), "hex");

  const key = await getHashedKey(secretKey);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted;
  try {
    decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    return new Error("Decryption failed ");
  }
}

async function getHashedKey(text) {
  return crypto.createHash("sha256").update(text).digest();
}

module.exports = questionController;
