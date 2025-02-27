// Node.js built-in modules
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Third-party packages
const jwt = require("jsonwebtoken");
const { Op, where } = require("sequelize");
const moment = require("moment-timezone");
const xss = require("xss");

// Database models
const db = require("../models");
const { log } = require("console");
const {
  Question,
  User,
  Submitted,
  Point,
  Category,
  Tournament: Tournaments,
  QuestionTournament,
  TournamentSubmitted,
  TournamentPoints,
  TeamScores,
  Hint,
  HintUsed,
  Team,
  Users_Team: User_Team,
  sequelize,
} = db;

// Sorting configuration
const SORT_CONFIG = {
  FIELDS: {
    QuestionName: "title",
    Solved: "SolvedCount",
    Difficulty: "difficulty_id",
    Point: "point",
    Category: "name",
  },
  DEFAULT_ORDERS: {
    TOURNAMENT: [
      [{ model: Question, as: "Question" }, "difficulty_id", "ASC"],
      [{ model: Question, as: "Question" }, "categories_id", "ASC"],
      [{ model: Question, as: "Question" }, "id", "ASC"],
    ],
    PRACTICE: [
      ["difficulty_id", "ASC"],
      ["categories_id", "ASC"],
      ["id", "ASC"],
    ],
  },
};

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

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
        difficulty_id,
        file,
        Practice,
        Hints,
        Tournament,
      } = request.payload;

      let ArrayHint = safeParseJSON(Hints);
      if (!ArrayHint) {
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

      if (!title || !Description || !Answer || !difficulty_id) {
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

      if (!isValidDifficulty(difficulty_id)) {
        return h
          .response({ message: "Invalid difficulty parameter" })
          .code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const sanitizedTitle = xss(trimmedTitle);
      const sanitizedDescription = xss(Description);

      const existingTitle = await Question.findOne({
        where: { title: trimmedTitle },
      });

      if (existingTitle) {
        return h.response({ message: "Topic already exists" }).code(409);
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
        if (await isFileExists(file.filename)) {
          return h.response({ message: "File already exists" }).code(409);
        }
        try {
          file_path = await uploadFile(file);
        } catch (err) {
          return h.response({ message: err.message }).code(500);
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
          difficulty_id,
          file_path,
          Practice: isPractice,
          Tournament: isTournament,
          createdBy: `${user.first_name} ${user.last_name}`,
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

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
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

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
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
        include: [{ model: Question, as: "Question" }],
        transaction,
      });

      if (!questions) {
        return h
          .response({ message: "Question not found in tournament" })
          .code(404);
      }

      const existingSubmission = await TournamentSubmitted.findAll({
        where: {
          question_tournament_id: questions.id,
          tournament_id: parsedTournamentId,
        },
        attributes: [
          "question_tournament_id",
          "team_id",
          "users_id",
          "tournament_id",
        ],
        raw: true,
        transaction,
      });

      if (existingSubmission.length > 0) {
        const TeamIds = existingSubmission.map((item) => item.team_id);
        const UserIds = existingSubmission.map((item) => item.users_id);
        const QuestionPoints = questions.Question.point;

        await TeamScores.update(
          {
            total_points: sequelize.literal(`total_points - ${QuestionPoints}`),
          },
          {
            where: {
              team_id: { [Op.in]: TeamIds },
              tournament_id: parsedTournamentId,
            },
            transaction,
          }
        );

        await TournamentPoints.update(
          { points: sequelize.literal(`points - ${QuestionPoints}`) },
          { where: { users_id: { [Op.in]: UserIds } }, transaction }
        );

        await TournamentSubmitted.destroy({
          where: {
            question_tournament_id: {
              [Op.in]: existingSubmission.map((s) => s.question_tournament_id),
            },
          },
          transaction,
        });
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
      if (transaction) await transaction.rollback();

      return h.response({ message: error.message }).code(500);
    }
  },

  getQuestionById: async (request, h) => {
    try {
      const { id, tournament_id } = request.query;
      const questionId = parseInt(id, 10);

      if (isNaN(questionId) || questionId <= 0) {
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const question = await Question.findByPk(questionId, {
        attributes: {
          exclude:
            user.role === "Admin"
              ? ["createdAt", "updatedAt"]
              : ["Answer", "createdAt", "updatedAt"],
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

      if (tournament_id) {
        const parsedTournamentId = parseInt(tournament_id, 10);
        if (isNaN(parsedTournamentId) || parsedTournamentId <= 0) {
          return h.response({ message: "Invalid tournament ID" }).code(400);
        }

        const tournament = await Tournaments.findOne({
          where: { id: parsedTournamentId },
        });

        if (!tournament) {
          return h.response({ message: "Tournament not found" }).code(404);
        }

        const existingTournament = await QuestionTournament.findOne({
          where: {
            questions_id: questionId,
            tournament_id: parsedTournamentId,
          },
        });

        if (!existingTournament) {
          return h
            .response({
              message: "This question is not part of the selected tournament.",
            })
            .code(404);
        }

        if (user.role !== "Admin") {
          const currentTime = moment.tz("Asia/Bangkok").utc().toDate();
          if (currentTime > tournament.event_endDate) {
            return h
              .response({ message: "This tournament has already ended." })
              .code(400);
          }

          if (currentTime < tournament.event_startDate) {
            return h
              .response({ message: "This tournament has not started yet." })
              .code(400);
          }

          const userTeam = await User_Team.findOne({
            where: { users_id: user.user_id },
            include: [
              {
                model: Team,
                as: "team",
                where: { tournament_id: parsedTournamentId },
              },
            ],
          });

          if (!userTeam) {
            return h
              .response({ message: "User is not part of this tournament." })
              .code(404);
          }
        }
      } else if (user.role !== "Admin") {
        if (!question.Practice && !question.Tournament) {
          return h
            .response({ message: "This question is not available." })
            .code(404);
        } else if (!question.Practice && question.Tournament) {
          const validQuestion = await QuestionTournament.findOne({
            where: { questions_id: questionId },
          });

          if (!validQuestion) {
            return h
              .response({ message: "This question is not available." })
              .code(404);
          }
        }
      }

      const HintData = await Hint.findAll({
        where: { question_id: question.id },
        attributes: ["id", "Description", "point"],
        order: [["id", "ASC"]],
      });

      const isSolved = await Submitted.findOne({
        where: { users_id: user.user_id, question_id: question.id },
        attributes: ["question_id"],
      });

      const hintWithUsed =
        user.role === "Admin"
          ? HintData
          : await Promise.all(
              HintData.map(async (hint) => ({
                id: hint.id,
                point: hint.point,
                used: !!(await HintUsed.findOne({
                  where: { hint_id: hint.id, user_id: user.user_id },
                })),
              }))
            );

      const baseData = {
        id: question.id,
        title: question.title,
        description: question.Description,
        point: question.point,
        categories_name: question.Category?.name,
        difficulty_id: question.difficulty_id,
        file_path: question.file_path,
        author: question.createdBy,
      };

      let mode;
      if (question.Practice) {
        mode = "Practice";
      } else if (question.Tournament) {
        mode = "Tournament";
      } else {
        mode = "Unpublished";
      }

      const responseData =
        user.role === "Admin"
          ? {
              ...baseData,
              categories_id: question.Category?.id,
              answer: await decryptData(
                question.Answer,
                process.env.ANSWER_SECRET_KEY
              ),
              hints: HintData,
              mode,
            }
          : {
              ...baseData,
              solved: !!isSolved,
              hints: hintWithUsed,
            };

      return h.response(responseData).code(200);
    } catch (error) {
      console.log(error);

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
        sort,
        sort_order,
      } = request.query;

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const parsedPage = parseInt(page, 10);

      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 12;
      const offset = (parsedPage - 1) * limit;

      const validModes = ["Practice", "Tournament"];
      let where = {};
      let question = {};
      let totalPages = 0;
      let hasNextPage = false;
      let mappedData = [];
      let TournamentSovledIds = [];

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
        if (!isValidDifficulty(difficulty)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
        where.difficulty_id = difficulty;
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

              const TournamentSovled = await TournamentSubmitted.findAll({
                where: { team_id: Userteam.team_id },
                include: [
                  {
                    model: QuestionTournament,
                    as: "QuestionTournament",
                    attributes: ["questions_id"],
                  },
                ],
                attributes: [
                  "question_tournament_id",
                  "team_id",
                  "users_id",
                  "tournament_id",
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
              order: await createSorting({ sort, sort_order, mode }),
              include: [
                {
                  model: Question,
                  as: "Question",
                  where,
                  attributes: {
                    exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
                    include: [
                      [
                        sequelize.literal(
                          `(
                                SELECT CAST(COUNT(*) AS INTEGER)
                                FROM public."TournamentSubmitted" AS TS
                                JOIN public."QuestionTournaments" AS QT
                                ON TS.question_tournament_id = QT.id
                                WHERE QT.questions_id = "Question"."id"
                                AND QT.tournament_id = ${parsedTournamentId}
                              )`
                        ),
                        "SolvedCount",
                      ],
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

            mappedData = question.rows.map((qt) => {
              const q = qt.Question || qt;
              return {
                id: q.id,
                title: q.title,
                point: q.point,
                categories_name: q.Category?.name,
                difficulty_id: q.difficulty_id,
                solved: TournamentSovledIds.includes(q.id),
                submitCount: q.dataValues.SolvedCount || 0,
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
        order: await createSorting({ sort, sort_order, mode }),
        attributes: {
          exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
          include: [
            [
              sequelize.literal(`(
            SELECT CAST(COUNT(*) AS INTEGER)
            FROM public."Submitted" AS Submitted 
            WHERE Submitted.question_id = "Question".id
            )`),
              "SolvedCount",
            ],
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

      const solvedQuestions = await Submitted.findAll({
        where: { users_id: user.user_id },
        attributes: ["question_id"],
      });

      const solvedIds = solvedQuestions.map((item) => item.question_id);

      mappedData = question.rows.map((q) => ({
        id: q.id,
        title: q.title,
        point: q.point,
        categories_name: q.Category?.name,
        difficulty_id: q.difficulty_id,
        author: q.createdBy,
        solved: solvedIds.includes(q.id),
        submitCount: q.dataValues.SolvedCount || 0,
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
        sort,
        sort_order,
      } = request.query;

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const parsedPage = parseInt(page, 10);
      if (isNaN(parsedPage) || parsedPage <= 0) {
        return h.response({ message: "Invalid page parameter" }).code(400);
      }

      const limit = 12;
      const offset = (parsedPage - 1) * limit;
      const validModes = ["Practice", "Tournament", "Unpublished"];
      let where = {};
      let question = {};
      let totalPages = 0;
      let hasNextPage = false;
      let mappedData = [];

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
        if (!isValidDifficulty(difficulty)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
        where.difficulty_id = difficulty;
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
                order: await createSorting({ sort, sort_order, mode }),
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
                      include: [
                        [
                          sequelize.literal(
                            `(
                              SELECT CAST(COUNT(*) AS INTEGER)
                              FROM public."TournamentSubmitted" AS TS
                              JOIN public."QuestionTournaments" AS QT
                              ON TS.question_tournament_id = QT.id
                              WHERE QT.questions_id = "Question"."id"
                              AND QT.tournament_id = ${parsedTournamentId}
                            )`
                          ),
                          "SolvedCount",
                        ],
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
                subQuery: false,
              });
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
                limit,
                offset,
                order: await createSorting({
                  sort,
                  sort_order,
                  mode: "Practice",
                }),
                attributes: {
                  exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
                  include: [
                    [
                      sequelize.literal(`(
                        SELECT CAST(COUNT(*) AS INTEGER)
                        FROM public."TournamentSubmitted" AS TS
                        JOIN public."QuestionTournaments" AS QT ON TS.question_tournament_id = QT.id
                        WHERE QT.questions_id = "Question".id
                      )`),
                      "SolvedCount",
                    ],
                  ],
                },
                include: [
                  {
                    model: Category,
                    attributes: ["name"],
                  },
                ],

                subQuery: false,
              });
            }

            mappedData = question.rows.map((qt) => {
              const q = qt.Question || qt;
              return {
                id: q.id,
                title: q.title,
                point: q.point,
                categories_name: q.Category?.name,
                difficulty_id: q.difficulty_id,
                author: q.createdBy,
                mode: "Tournament",
                is_selected: questionIds.includes(q.id),
                submitCount: q.dataValues.SolvedCount || 0,
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
        order: await createSorting({ sort, sort_order, mode }),
        attributes: {
          exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
          include: [
            [
              sequelize.literal(`(
          SELECT CAST(COUNT(*) AS INTEGER) 
          FROM public."Submitted" AS Submitted 
          WHERE Submitted.question_id = "Question".id
          )`),
              "submitCount",
            ],
            [
              sequelize.literal(`(
          SELECT CAST(COUNT(*) AS INTEGER)
          FROM public."TournamentSubmitted" AS TS
          JOIN public."QuestionTournaments" AS QT ON TS.question_tournament_id = QT.id
          WHERE QT.questions_id = "Question".id
          )`),
              "submitCountTournament",
            ],
            [
              sequelize.literal(`(
                SELECT CAST(COUNT(*) AS INTEGER)
                FROM (
                  SELECT question_id as qid FROM public."Submitted"
                  UNION ALL
                  SELECT QT.questions_id 
                  FROM public."TournamentSubmitted" AS TS
                  JOIN public."QuestionTournaments" AS QT ON TS.question_tournament_id = QT.id
                ) AS combined
                WHERE combined.qid = "Question".id
              )`),
              "SolvedCount",
            ],
          ],
        },
        include: [
          {
            model: Category,
            as: "Category",
            attributes: ["name"],
          },
        ],
        subQuery: false,
      });

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
          submitCount = q.dataValues.submitCountTournament || 0;
          mode = "Tournament";
          is_selected = questionIds.includes(q.id);
        } else if (q.Practice) {
          submitCount = q.dataValues.submitCount || 0;
          mode = "Practice";
        }
        return {
          id: q.id,
          title: q.title,
          point: q.point,
          categories_name: q.Category?.name || null,
          difficulty_id: q.difficulty_id,
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

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const {
        categories_id,
        title,
        Description,
        Answer,
        point,
        difficulty_id,
        file,
        Practice,
        Tournament,
        Hints,
        isFileEdited,
      } = request.payload;

      const question = await Question.findByPk(questionId);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      let ArrayHint = safeParseJSON(Hints);
      if (!ArrayHint) {
        return h.response({ message: "Invalid Hints format" }).code(400);
      }

      if (isFileEdited !== "true" && isFileEdited !== "false") {
        return h
          .response({ message: "Invalid value for isFileEdited" })
          .code(400);
      }

      if (
        await Submitted.findOne({
          where: { question_id: questionId },
          attributes: ["question_id"],
        })
      ) {
        return h
          .response({ message: "Question has been submitted, cannot update" })
          .code(400);
      }

      if (
        await TournamentSubmitted.findOne({
          attributes: ["question_tournament_id"],
          include: [
            { model: QuestionTournament, where: { questions_id: questionId } },
          ],
          raw: true,
        })
      ) {
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
          attributes: ["hint_id", "user_id", "team_id"],
          raw: true,
          transaction,
        });
        if (existingHintUsed.length > 0) {
          return h
            .response({ message: "Question has been used hint, cannot update" })
            .code(400);
        }
      }

      if (
        await QuestionTournament.findOne({
          where: { questions_id: questionId },
        })
      ) {
        return h
          .response({ message: "Question in tournament cannot be updated" })
          .code(400);
      }

      if (title) {
        const trimmedTitle = title.trim();
        if (
          await Question.findOne({
            where: { title: trimmedTitle, id: { [Op.ne]: questionId } },
          })
        ) {
          return h.response({ message: "Title already exists" }).code(409);
        }
        question.title = xss(trimmedTitle);
      }

      let file_path = question.file_path;
      if (file?.filename) {
        if (await isFileExists(file.filename)) {
          return h.response({ message: "File already exists" }).code(409);
        }
        try {
          await deleteFile(question.file_path);
          file_path = await uploadFile(file);
        } catch (err) {
          return h.response({ message: err.message }).code(500);
        }
      } else if (isFileEdited === "true" && question.file_path) {
        await deleteFile(question.file_path);
        file_path = null;
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

      if (difficulty_id) {
        if (!isValidDifficulty(difficulty_id)) {
          return h
            .response({ message: "Invalid difficulty parameter" })
            .code(400);
        }
        question.difficulty_id = difficulty_id;
      }

      if (Description) {
        question.Description = xss(Description);
      }

      if (Answer) {
        const trimmedAnswer = Answer.trim();
        const secretKey = process.env.ANSWER_SECRET_KEY;
        question.Answer = await encryptData(trimmedAnswer, secretKey);
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

      const isPractice = Practice === "true";
      const isTournament = Tournament === "true";

      if (isPractice && isTournament) {
        return h
          .response({ message: "Practice and Tournament cannot both be true" })
          .code(400);
      }

      question.Practice = isPractice;
      question.Tournament = isTournament;
      question.file_path = file_path;

      await question.save({ transaction });
      await transaction.commit();

      return h.response(question).code(200);
    } catch (error) {
      if (transaction) await transaction.rollback();

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

      const user = await authenticateUser(token);

      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const question = await Question.findByPk(questionId, { transaction });
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      if (question.file_path) {
        try {
          await deleteFile(question.file_path);
        } catch (error) {
          return h
            .response({ message: "Failed to delete associated file" })
            .code(500);
        }
      }

      const existingHints = await Hint.findAll({
        where: { question_id: question.id },
        transaction,
      });

      const existingHintUsed = await HintUsed.findAll({
        where: { hint_id: { [Op.in]: existingHints.map((item) => item.id) } },
        attributes: ["hint_id", "user_id", "team_id"],
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

      const existingSubmitted = await Submitted.findAll({
        where: { question_id: question.id },
        attributes: ["question_id"],
        transaction,
      });

      if (existingSubmitted.length > 0) {
        const UserIds = existingSubmitted.map((item) => item.users_id);
        await Point.update(
          { points: sequelize.literal("points - " + question.point) },
          { where: { users_id: { [Op.in]: UserIds } }, transaction }
        );

        await Submitted.destroy({
          where: { question_id: question.id },
          transaction,
        });
      }

      const existingTournaments = await QuestionTournament.findAll({
        where: { questions_id: question.id },
        transaction,
      });

      if (existingTournaments.length > 0) {
        const existingTournamentIds = existingTournaments.map(
          (item) => item.id
        );
        const existingTournamentSubmitted = await TournamentSubmitted.findAll({
          where: {
            question_tournament_id: {
              [Op.in]: existingTournamentIds,
            },
          },
          attributes: [
            "question_tournament_id",
            "team_id",
            "users_id",
            "tournament_id",
          ],
          raw: true,
          transaction,
        });

        if (existingTournamentSubmitted.length > 0) {
          const TeamIds = existingTournamentSubmitted.map(
            (item) => item.team_id
          );

          const UserIds = existingTournamentSubmitted.map(
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
                tournament_id: {
                  [Op.in]: existingTournaments.map((t) => t.tournament_id),
                },
              },
              transaction,
            }
          );
          await TournamentPoints.update(
            {
              points: sequelize.literal("points - " + question.point),
            },
            {
              where: { users_id: { [Op.in]: UserIds } },
              transaction,
            }
          );

          await TournamentSubmitted.destroy({
            where: {
              question_tournament_id: { [Op.in]: existingTournamentIds },
            },
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

      const user = await authenticateUser(token);
      if (!user) {
        await transaction.rollback();
        return h.response({ message: "User not found" }).code(404);
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
        let point = await Point.findOne({
          where: { users_id: user.user_id },
          transaction,
        });

        if (!point) {
          await transaction.rollback();
          return h.response({ message: "Point not found" }).code(404);
        }

        if (user.role === "Admin") {
          point.points += question.point;
          await point.save({ transaction });

          await transaction.commit();
          return h.response({ message: "Correct", solve: true }).code(200);
        }

        const existingSubmission = await Submitted.findOne({
          where: {
            users_id: user.user_id,
            question_id: question.id,
          },
          attributes: ["question_id", "users_id"],
          raw: true,
          transaction,
        });

        if (existingSubmission) {
          await transaction.rollback();
          return h
            .response({ message: "Already submitted", solve: true })
            .code(200);
        }

        await Submitted.create(
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

      const tournament = await Tournaments.findByPk(tournamentId, {
        transaction,
      });

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      if (user.role !== "Admin") {
        const currentTime = moment.tz("Asia/Bangkok").utc().toDate();

        if (currentTime > tournament.event_endDate) {
          return h.response({ message: "Tournament has ended" }).code(400);
        }

        if (currentTime < tournament.event_startDate) {
          return h
            .response({ message: "Tournament has not started" })
            .code(400);
        }
      }

      const question = await QuestionTournament.findOne({
        where: { questions_id: parsedId, tournament_id: tournamentId },
        include: [
          {
            model: Question,
            as: "Question",
            attributes: ["Answer", "point", "Practice"],
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

      const secretKeyForAnswer = process.env.ANSWER_SECRET_KEY;
      const correctAnswer = await decryptData(
        question.Question.Answer,
        secretKeyForAnswer
      );

      if (user.role === "Admin") {
        await transaction.commit();
        return h
          .response({
            message: Answer === correctAnswer ? "Correct" : "Incorrect",
            solve: Answer === correctAnswer,
          })
          .code(200);
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
        return h.response({ message: "User not in this tournament" }).code(404);
      }

      let point = await TournamentPoints.findOne({
        where: {
          users_id: UserTeam.users_id,
          tournament_id: tournamentId,
          team_id: UserTeam.team_id,
        },
        transaction,
      });

      if (!point) {
        return h.response({ message: "Point not found" }).code(404);
      }

      const existingSubmission = await TournamentSubmitted.findOne({
        where: {
          question_tournament_id: question.id,
          team_id: UserTeam.team_id,
        },
        attributes: [
          "question_tournament_id",
          "team_id",
          "users_id",
          "tournament_id",
        ],
        raw: true,
        transaction,
      });

      if (existingSubmission) {
        return h
          .response({ message: "Already submitted", solve: true })
          .code(200);
      }

      if (Answer === correctAnswer) {
        await TournamentSubmitted.create(
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
      await transaction.rollback();

      return h.response({ message: "Internal Server Error" }).code(500);
    }
  },

  downloadFile: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const { id, tournament_id } = request.query;
      const questionId = parseInt(id, 10);

      if (isNaN(questionId) || questionId <= 0) {
        await transaction.rollback();
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        await transaction.rollback();
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        await transaction.rollback();
        return h.response({ message: "User not found" }).code(404);
      }

      const question = await Question.findByPk(questionId, { transaction });
      if (!question) {
        await transaction.rollback();
        return h.response({ message: "Question not found" }).code(404);
      }

      if (!question.file_path) {
        await transaction.rollback();
        return h
          .response({ message: "No file available for this question" })
          .code(400);
      }

      const questionTournament = await QuestionTournament.findOne({
        where: { questions_id: questionId },
        transaction,
      });

      if (questionTournament && user.role !== "Admin" && !tournament_id) {
        await transaction.rollback();
        return h.response({ message: "Unauthorized" }).code(401);
      }

      if (tournament_id) {
        const tournamentId = parseInt(tournament_id, 10);

        if (isNaN(tournamentId) || tournamentId <= 0) {
          await transaction.rollback();
          return h.response({ message: "Invalid tournament ID" }).code(400);
        }

        const tournament = await Tournaments.findByPk(tournamentId, {
          transaction,
        });
        if (!tournament) {
          await transaction.rollback();
          return h.response({ message: "Tournament not found" }).code(404);
        }

        const currentTime = moment.tz("Asia/Bangkok").utc().toDate();

        if (currentTime > tournament.event_endDate) {
          await transaction.rollback();
          return h.response({ message: "Tournament has ended" }).code(400);
        }

        if (currentTime < tournament.event_startDate) {
          await transaction.rollback();
          return h
            .response({ message: "Tournament has not started" })
            .code(400);
        }

        const existingTournament = await QuestionTournament.findOne({
          where: { questions_id: questionId, tournament_id: tournamentId },
          transaction,
        });

        if (!existingTournament) {
          await transaction.rollback();
          return h
            .response({ message: "Question not available for this tournament" })
            .code(400);
        }

        if (user.role !== "Admin") {
          const userTeam = await User_Team.findOne({
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

          if (!userTeam) {
            await transaction.rollback();
            return h
              .response({ message: "User not in this tournament" })
              .code(404);
          }
        }
      }

      const filePath = path.resolve(
        __dirname,
        "..",
        "uploads",
        question.file_path
      );

      await transaction.commit();
      return h.file(filePath, {
        confine: false,
        mode: "attachment",
        filename: question.file_path,
        headers: {
          "Content-Disposition": `attachment; filename=${question.file_path}`,
        },
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      return h.response({ message: error.message }).code(500);
    }
  },
  UseHint: async (request, h) => {
    const transaction = await sequelize.transaction();
    try {
      const { id, tournament_id } = request.query;
      const hintId = parseInt(id, 10);

      if (isNaN(hintId) || hintId <= 0) {
        await transaction.rollback();
        return h.response({ message: "Invalid hint ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        await transaction.rollback();
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        await transaction.rollback();
        return h.response({ message: "User not found" }).code(404);
      }

      const hint = await Hint.findOne({ where: { id: hintId }, transaction });
      if (!hint) {
        await transaction.rollback();
        return h.response({ message: "Hint not found" }).code(404);
      }

      if (user.role === "Admin") {
        await transaction.commit();
        return h.response({ data: hint.Description }).code(200);
      }

      const isTournamentQuestion = await QuestionTournament.findOne({
        where: { questions_id: hint.question_id },
        transaction,
      });

      if (isTournamentQuestion && !tournament_id && user.role !== "Admin") {
        await transaction.rollback();
        return h.response({ message: "Unauthorized" }).code(401);
      }

      let tournamentId = null;

      if (tournament_id) {
        tournamentId = parseInt(tournament_id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
          await transaction.rollback();
          return h.response({ message: "Invalid tournament ID" }).code(400);
        }

        const tournament = await Tournaments.findByPk(tournamentId, {
          transaction,
        });
        if (!tournament) {
          await transaction.rollback();
          return h.response({ message: "Tournament not found" }).code(404);
        }

        const currentTime = moment.tz("Asia/Bangkok").utc().toDate();
        if (currentTime > tournament.event_endDate) {
          await transaction.rollback();
          return h.response({ message: "Tournament has ended" }).code(400);
        }
        if (currentTime < tournament.event_startDate) {
          await transaction.rollback();
          return h
            .response({ message: "Tournament has not started" })
            .code(400);
        }

        const existingTournament = await QuestionTournament.findOne({
          where: {
            questions_id: hint.question_id,
            tournament_id: tournamentId,
          },
          transaction,
        });

        if (!existingTournament) {
          await transaction.rollback();
          return h
            .response({ message: "Hint not available for this tournament" })
            .code(400);
        }

        const userTeam = await User_Team.findOne({
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

        if (!userTeam) {
          await transaction.rollback();
          return h
            .response({ message: "User not in this tournament" })
            .code(404);
        }

        const existingHintUsedTournament = await HintUsed.findOne({
          where: {
            hint_id: hint.id,
            team_id: userTeam.team_id,
          },
          attributes: ["hint_id", "user_id", "team_id"],
          raw: true,
          transaction,
        });

        if (existingHintUsedTournament) {
          await transaction.commit();
          return h.response({ data: hint.Description }).code(200);
        }

        const pointTournament = await TournamentPoints.findOne({
          where: { users_id: userTeam.users_id, tournament_id: tournamentId },
          transaction,
        });

        if (!pointTournament) {
          await transaction.rollback();
          return h.response({ message: "Point not found" }).code(404);
        }

        if (pointTournament.points < hint.point) {
          await transaction.rollback();
          return h.response({ message: "Not enough points" }).code(400);
        }

        pointTournament.points -= hint.point;
        await pointTournament.save({ transaction });

        await HintUsed.create(
          {
            hint_id: hint.id,
            user_id: user.user_id,
            team_id: userTeam.team_id,
          },
          { transaction }
        );

        await transaction.commit();
        return h
          .response({ message: "Hint used", data: hint.Description })
          .code(200);
      }

      const point = await Point.findOne({
        where: { users_id: user.user_id },
        transaction,
      });
      if (!point) {
        await transaction.rollback();
        return h.response({ message: "Point not found" }).code(404);
      }

      if (point.points < hint.point) {
        await transaction.rollback();
        return h.response({ message: "Not enough points" }).code(400);
      }

      point.points -= hint.point;
      await point.save({ transaction });

      await HintUsed.create(
        { hint_id: hint.id, user_id: user.user_id, team_id: null },
        { transaction }
      );

      await transaction.commit();
      return h
        .response({ message: "Hint used", data: hint.Description })
        .code(200);
    } catch (error) {
      if (transaction) await transaction.rollback();
      return h.response({ message: error.message }).code(500);
    }
  },
};

async function authenticateUser(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
  } catch (err) {
    return null;
  }

  const user = await User.findOne({
    where: {
      itaccount: decoded.email,
    },
  });

  return user;
}

async function createSorting({ sort, sort_order, mode }) {
  if (sort && sort_order) {
    const upperSortOrder = sort_order.toUpperCase();
    const sortField = SORT_CONFIG.FIELDS[sort];
    if (sortField) {
      return buildOrder(sortField, upperSortOrder, mode);
    }
  }
  return getDefaultOrder(mode);
}

function buildOrder(sortField, upperSortOrder, mode) {
  let order = [];
  if (sortField === "SolvedCount") {
    order.push([sequelize.literal('"SolvedCount"'), upperSortOrder]);
  } else if (sortField === "name") {
    order.push(buildCategoryOrder(sortField, upperSortOrder, mode));
  } else {
    order.push(buildFieldOrder(sortField, upperSortOrder, mode));
  }
  return order;
}

function buildCategoryOrder(sortField, upperSortOrder, mode) {
  if (mode === "Tournament") {
    return [
      { model: Question, as: "Question" },
      { model: Category, as: "Category" },
      sortField,
      upperSortOrder,
    ];
  } else {
    return [{ model: Category, as: "Category" }, sortField, upperSortOrder];
  }
}

function buildFieldOrder(sortField, upperSortOrder, mode) {
  if (mode === "Tournament") {
    return [{ model: Question, as: "Question" }, sortField, upperSortOrder];
  } else {
    return [sortField, upperSortOrder];
  }
}

function getDefaultOrder(mode) {
  return mode === "Tournament"
    ? SORT_CONFIG.DEFAULT_ORDERS.TOURNAMENT
    : SORT_CONFIG.DEFAULT_ORDERS.PRACTICE;
}

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

async function uploadFile(file) {
  if (!file) return null;

  const allowedFileTypes = [
    "application/x-compressed",
    "application/x-zip-compressed",
    "application/gzip",
  ];

  if (!allowedFileTypes.includes(file.headers["content-type"])) {
    throw new Error("Invalid file type");
  }

  const fileName = file.filename;
  const filePath = path.join(UPLOAD_DIR, fileName);

  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(
      filePath,
      await fs.promises.readFile(file.path)
    );
    return fileName;
  } catch (err) {
    throw new Error("Failed to upload file");
  }
}

async function deleteFile(filePath) {
  if (!filePath) return;

  try {
    const fullPath = path.join(UPLOAD_DIR, filePath);
    await fs.promises.access(fullPath);
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw new Error("Failed to delete file");
    }
  }
}

async function isFileExists(filename) {
  const existingFile = await Question.findOne({
    where: { file_path: filename },
  });
  return !!existingFile;
}

function safeParseJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

function isValidDifficulty(difficulty) {
  const validDifficulties = ["Easy", "Medium", "Hard"];
  return validDifficulties.includes(String(difficulty));
}
module.exports = questionController;
