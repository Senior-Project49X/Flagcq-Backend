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
    let file_path = null;
    let trimmedTitle = "";
    let transaction;

    try {
      transaction = await sequelize.transaction();

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

      const ArrayHint = safeParseJSON(Hints);
      if (!ArrayHint) {
        throw new Error("Invalid Hints format");
      }

      const parsedCategoriesId = parseInt(categories_id, 10);
      if (isNaN(parsedCategoriesId) || parsedCategoriesId <= 0) {
        throw new Error("Invalid categories_id");
      }

      const parsedPoint = parseInt(point, 10);
      if (isNaN(parsedPoint) || parsedPoint <= 0) {
        throw new Error("Invalid point");
      }

      if (!title || !Description || !Answer || !difficulty_id) {
        throw new Error("Missing required fields");
      }

      trimmedTitle = title.trim();
      const trimmedAnswer = Answer.trim();
      if (!trimmedTitle.length) {
        throw new Error("Title cannot be empty");
      }
      if (!trimmedAnswer.length) {
        throw new Error("Answer cannot be empty");
      }

      const secretKey = process.env.ANSWER_SECRET_KEY;
      if (!secretKey) {
        throw new Error("Server configuration error");
      }

      let encryptedAnswer;
      try {
        encryptedAnswer = await encryptData(trimmedAnswer, secretKey);
      } catch {
        throw new Error("Failed to encrypt answer");
      }

      if (!isValidDifficulty(difficulty_id)) {
        throw new Error("Invalid difficulty parameter");
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
        throw new Error("Topic already exists");
      }

      const category = await Category.findByPk(parsedCategoriesId, {
        attributes: ["id"],
      });

      if (!category) {
        throw new Error("Category not found");
      }

      if (file?.filename) {
        try {
          file_path = await uploadFile(file, trimmedTitle);
        } catch (err) {
          throw new Error(err.message);
        }
      }

      const isPractice = Practice === "true";
      const isTournament = Tournament === "true";

      if (Practice && !["true", "false"].includes(Practice)) {
        throw new Error("Invalid value for Practice");
      }

      if (Tournament && !["true", "false"].includes(Tournament)) {
        throw new Error("Invalid value for Tournament");
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

      if (ArrayHint?.length) {
        try {
          const { error, sanitizedHints } = await validateAndSanitizeHints(
            ArrayHint,
            question
          );
          if (error) throw new Error(error);

          if (sanitizedHints.length) {
            await Hint.bulkCreate(sanitizedHints, { transaction });
          }
        } catch (error) {
          throw new Error(`Hint error: ${error.message}`);
        }
      }

      await transaction.commit();
      return h.response({ message: "Question created successfully" }).code(201);
    } catch (error) {
      if (transaction) await transaction.rollback();

      if (file_path) {
        try {
          await deleteFile(trimmedTitle);
        } catch (deleteError) {
          console.error("⚠️ Failed to delete uploaded file:", deleteError);
        }
      }

      console.error(error);
      return h.response({ message: error.message }).code(500);
    } finally {
      if (transaction) await transaction.cleanup();
    }
  },

  addQuestionToTournament: async (request, h) => {
    let transaction;
    try {
      const { question_id, tournament_id } = request.payload;

      if (!Array.isArray(question_id) || question_id.length === 0) {
        return h
          .response({ message: "question_id must be a non-empty array" })
          .code(400);
      }

      const parsedQuestionIds = question_id
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id) && id > 0);
      if (parsedQuestionIds.length !== question_id.length) {
        return h.response({ message: "Invalid question_id format" }).code(400);
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
        return h
          .response({
            message: "Forbidden: Only admins can add questions to a tournament",
          })
          .code(403);
      }

      const [tournament, questions] = await Promise.all([
        Tournaments.findByPk(parsedTournamentId),
        Question.findAll({
          where: { id: { [Op.in]: parsedQuestionIds } },
        }),
      ]);

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }

      const currentTime = moment.tz("Asia/Bangkok").utc().toDate();
      if (currentTime > tournament.event_endDate) {
        return h.response({ message: "Tournament has ended" }).code(400);
      }

      if (questions.length !== parsedQuestionIds.length) {
        return h.response({ message: "Some questions not found" }).code(404);
      }

      const existingAssociations = await QuestionTournament.findAll({
        where: {
          tournament_id: parsedTournamentId,
          questions_id: { [Op.in]: parsedQuestionIds },
        },
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
        transaction = await sequelize.transaction();
        await QuestionTournament.bulkCreate(newQuestions, { transaction });
        await transaction.commit();
      }

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
    let transaction;
    try {
      const { tournamentId, questionIds } = request.params;

      if (!questionIds || !tournamentId) {
        return h.response({ message: "Missing required parameters" }).code(400);
      }

      const parsedQuestionId = parseInt(questionIds, 10);
      const parsedTournamentId = parseInt(tournamentId, 10);

      if (isNaN(parsedQuestionId) || parsedQuestionId <= 0) {
        return h.response({ message: "Invalid question_id" }).code(400);
      }
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
        return h
          .response({ message: "Forbidden: Only admins can remove questions" })
          .code(403);
      }

      const [tournament, questionTournament] = await Promise.all([
        Tournaments.findByPk(parsedTournamentId),
        QuestionTournament.findOne({
          where: {
            questions_id: parsedQuestionId,
            tournament_id: parsedTournamentId,
          },
          include: [{ model: Question, as: "Question" }],
        }),
      ]);

      if (!tournament) {
        return h.response({ message: "Tournament not found" }).code(404);
      }
      if (!questionTournament) {
        return h
          .response({ message: "Question not found in tournament" })
          .code(404);
      }

      const existingSubmission = await TournamentSubmitted.findAll({
        where: {
          question_tournament_id: questionTournament.id,
          tournament_id: parsedTournamentId,
        },
        attributes: ["question_tournament_id", "team_id", "users_id"],
        raw: true,
      });

      transaction = await sequelize.transaction();

      if (existingSubmission.length > 0) {
        const teamIds = existingSubmission.map((item) => item.team_id);
        const userIds = existingSubmission.map((item) => item.users_id);
        const questionPoints = questionTournament.Question.point;

        await Promise.all([
          TeamScores.update(
            {
              total_points: sequelize.literal(
                `total_points - ${questionPoints}`
              ),
            },
            {
              where: {
                team_id: { [Op.in]: teamIds },
                tournament_id: parsedTournamentId,
              },
              transaction,
            }
          ),
          TournamentPoints.update(
            { points: sequelize.literal(`points - ${questionPoints}`) },
            { where: { users_id: { [Op.in]: userIds } }, transaction }
          ),
          TournamentSubmitted.destroy({
            where: {
              question_tournament_id: {
                [Op.in]: existingSubmission.map(
                  (s) => s.question_tournament_id
                ),
              },
            },
            transaction,
          }),
        ]);
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
          { model: Category, as: "Category", attributes: ["name", "id"] },
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

        const [tournament, existingTournament] = await Promise.all([
          Tournaments.findOne({ where: { id: parsedTournamentId } }),
          QuestionTournament.findOne({
            where: {
              questions_id: questionId,
              tournament_id: parsedTournamentId,
            },
          }),
        ]);

        if (!tournament) {
          return h.response({ message: "Tournament not found" }).code(404);
        }
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
        }
        if (!question.Practice && question.Tournament) {
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

      const [HintData, isSolved] = await Promise.all([
        Hint.findAll({
          where: { question_id: question.id },
          attributes: ["id", "Description", "point"],
          order: [["id", "ASC"]],
        }),
        Submitted.findOne({
          where: { users_id: user.user_id, question_id: question.id },
          attributes: ["question_id"],
        }),
      ]);

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
              attributes: [
                "id",
                "questions_id",
                [
                  sequelize.literal(`(
                    SELECT CAST(COUNT(*) AS INTEGER)
                    FROM public."TournamentSubmitted" AS TS
                    JOIN public."QuestionTournaments" AS QT
                    ON TS.question_tournament_id = QT.id
                    WHERE QT.questions_id = "QuestionTournament"."questions_id"
                    AND QT.tournament_id = ${parsedTournamentId}
                  )`),
                  "SolvedCount",
                ],
              ],
              include: [
                {
                  model: Question,
                  as: "Question",
                  where,
                  attributes: {
                    exclude: ["Answer", "createdAt", "createdBy", "updatedAt"],
                    include: [
                      [
                        sequelize.literal(`(
                          SELECT CAST(COUNT(*) AS INTEGER) 
                          FROM public."Hint_Used" AS HU 
                          JOIN public."Hints" AS H ON H.id = HU.hint_id
                          WHERE H.question_id = "Question".id
                        )`),
                        "HintUsedCount",
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
              group: [
                "QuestionTournament.id",
                "Question.id",
                "Question->Category.id",
              ],
              subQuery: false,
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
                submitCount: qt.dataValues.SolvedCount || 0,
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
                attributes: [
                  "id",
                  "questions_id",
                  [
                    sequelize.literal(`(
                      SELECT CAST(COUNT(*) AS INTEGER)
                      FROM public."TournamentSubmitted" AS TS
                      JOIN public."QuestionTournaments" AS QT
                      ON TS.question_tournament_id = QT.id
                      WHERE QT.questions_id = "QuestionTournament"."questions_id"
                      AND QT.tournament_id = ${parsedTournamentId}
                    )`),
                    "SolvedCount",
                  ],
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
                      include: [
                        [
                          sequelize.literal(`(
                            SELECT CAST(COUNT(*) AS INTEGER) 
                            FROM public."Hint_Used" AS HU 
                            JOIN public."Hints" AS H ON H.id = HU.hint_id
                            WHERE H.question_id = "Question".id
                          )`),
                          "HintUsedCount",
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
                group: [
                  "QuestionTournament.id",
                  "Question.id",
                  "Question->Category.id",
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
                  attributes: [
                    [
                      sequelize.fn("DISTINCT", sequelize.col("questions_id")),
                      "questions_id",
                    ],
                  ],
                  raw: true,
                });

                questionIds = existingQuestionIds.map(
                  (item) => item.questions_id
                );
              } else {
                const existingQuestionIds = await QuestionTournament.findAll({
                  attributes: [
                    [
                      sequelize.fn("DISTINCT", sequelize.col("questions_id")),
                      "questions_id",
                    ],
                  ],
                  raw: true,
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
                        JOIN public."QuestionTournaments" AS QT 
                        ON TS.question_tournament_id = QT.id
                        WHERE QT.questions_id = "Question".id
                      )`),
                      "SolvedCount",
                    ],
                    [
                      sequelize.literal(`(
                        SELECT CAST(COUNT(*) AS INTEGER) 
                        FROM public."Hint_Used" AS HU 
                        JOIN public."Hints" AS H ON H.id = HU.hint_id
                        WHERE H.question_id = "Question".id
                      )`),
                      "HintUsedCount",
                    ],
                  ],
                },
                include: [
                  {
                    model: Category,
                    attributes: ["name"],
                  },
                ],
                group: ["Question.id", "Category.id"],
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
                submitCount: qt.dataValues.SolvedCount || 0,
                canEdit:
                  (qt.dataValues.SolvedCount || 0) === 0 &&
                  (qt.dataValues.HintUsedCount || 0) === 0,
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
            console.log(error);
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
            [
              sequelize.literal(`(
                SELECT CAST(COUNT(*) AS INTEGER) 
                FROM public."Hint_Used" AS HU 
                JOIN public."Hints" AS H ON H.id = HU.hint_id
                WHERE H.question_id = "Question".id
              )`),
              "HintUsedCount",
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

        const isCanEdit =
          q.dataValues.submitCount === 0 &&
          q.dataValues.submitCountTournament === 0 &&
          q.dataValues.HintUsedCount === 0;

        return {
          id: q.id,
          title: q.title,
          point: q.point,
          categories_name: q.Category?.name || null,
          difficulty_id: q.difficulty_id,
          mode: mode,
          submitCount: submitCount,
          is_selected: is_selected,
          canEdit: isCanEdit,
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
      console.log(error);
      return h.response({ message: error.message }).code(500);
    }
  },
  updateQuestion: async (request, h) => {
    let newFilePath = null;
    let shouldDeleteFile = false;

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

      const oldFolderPath = question.title;

      const [
        isSubmitted,
        isTournamentSubmitted,
        existingHint,
        category,
        isInTournament,
      ] = await Promise.all([
        Submitted.findOne({ where: { question_id: questionId } }),
        TournamentSubmitted.findOne({
          include: [
            { model: QuestionTournament, where: { questions_id: questionId } },
          ],
          raw: true,
        }),
        Hint.findAll({ where: { question_id: questionId } }),
        categories_id
          ? Category.findOne({
              where: { id: parseInt(categories_id, 10) },
              attributes: ["id"],
            })
          : null,
        QuestionTournament.findOne({ where: { questions_id: questionId } }),
      ]);

      if (isSubmitted || isTournamentSubmitted) {
        return h
          .response({ message: "Question has been submitted, cannot update" })
          .code(400);
      }

      if (existingHint.length > 0) {
        const existingHintUsed = await HintUsed.findAll({
          where: { hint_id: { [Op.in]: existingHint.map((item) => item.id) } },
          attributes: ["hint_id"],
          raw: true,
        });

        if (existingHintUsed.length > 0) {
          return h
            .response({ message: "Question has been used hint, cannot update" })
            .code(400);
        }
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

      if (title) {
        const trimmedTitle = title.trim();
        const titleExists = await Question.findOne({
          where: { title: trimmedTitle, id: { [Op.ne]: questionId } },
        });
        if (titleExists) {
          return h.response({ message: "Title already exists" }).code(409);
        }
        question.title = xss(trimmedTitle);
      }

      if (file?.filename) {
        try {
          if (question.file_path) {
            await deleteFile(question.title);
          }
          newFilePath = await uploadFile(file, question.title);
        } catch (err) {
          return h.response({ message: "File upload failed" }).code(500);
        }
      } else if (isFileEdited === "true") {
        shouldDeleteFile = true;
        question.file_path = null;
      }

      const transaction = await sequelize.transaction();
      try {
        if (categories_id && category) {
          question.categories_id = category.id;
        }

        if (difficulty_id) {
          if (!isValidDifficulty(difficulty_id)) {
            throw new Error("Invalid difficulty parameter");
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
            throw new Error("Invalid point");
          }
          question.point = parsedPoint;
        }

        await Hint.destroy({
          where: { question_id: question.id },
          transaction,
        });

        try {
          const result = await validateAndSanitizeHints(ArrayHint, question);
          if (result.error) {
            throw new Error(result.error);
          }

          if (result.sanitizedHints.length > 0) {
            await Hint.bulkCreate(result.sanitizedHints, { transaction });
          }
        } catch (error) {
          throw new Error(`Hint error: ${error.message}`);
        }

        if (isInTournament) {
          if (Practice === "true") {
            throw new Error(
              "This question is in a tournament, cannot set to Practice"
            );
          }
        } else {
          question.Practice = Practice === "true";
          question.Tournament = Tournament === "true";

          if (question.Practice && question.Tournament) {
            throw new Error("Practice and Tournament cannot both be true");
          }
        }

        question.file_path = newFilePath || question.file_path;

        await question.save({ transaction });

        await transaction.commit();

        if (shouldDeleteFile) {
          try {
            await deleteFile(oldFolderPath);
          } catch (deleteError) {
            console.error("⚠️ Failed to delete old folder:", deleteError);
          }
        }

        return h.response(question).code(200);
      } catch (error) {
        await transaction.rollback();

        if (newFilePath) {
          try {
            await deleteFile(question.title);
          } catch (deleteError) {
            console.error(
              "⚠️ Failed to delete new folder after error:",
              deleteError
            );
          }
        }

        throw error;
      }
    } catch (error) {
      console.error(error);
      return h.response({ message: error.message }).code(500);
    }
  },

  deleteQuestion: async (request, h) => {
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
      if (!user || user.role !== "Admin") {
        return h.response({ message: "Forbidden: Only admins" }).code(403);
      }

      const question = await Question.findByPk(questionId);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      if (question.file_path) {
        try {
          await deleteFile(question.title);
        } catch (error) {
          return h
            .response({ message: "Failed to delete associated file" })
            .code(500);
        }
      }

      await sequelize.transaction(async (t) => {
        const existingHints = await Hint.findAll({
          where: { question_id: question.id },
          transaction: t,
        });
        if (existingHints.length > 0) {
          await HintUsed.destroy({
            where: { hint_id: existingHints.map((h) => h.id) },
            transaction: t,
          });
          await Hint.destroy({
            where: { question_id: question.id },
            transaction: t,
          });
        }

        const existingSubmitted = await Submitted.findAll({
          where: { question_id: question.id },
          transaction: t,
        });
        if (existingSubmitted.length > 0) {
          await Point.update(
            { points: sequelize.literal(`points - ${question.point}`) },
            {
              where: { users_id: existingSubmitted.map((s) => s.users_id) },
              transaction: t,
            }
          );
          await Submitted.destroy({
            where: { question_id: question.id },
            transaction: t,
          });
        }

        const existingTournaments = await QuestionTournament.findAll({
          where: { questions_id: question.id },
          transaction: t,
        });
        if (existingTournaments.length > 0) {
          await TournamentSubmitted.destroy({
            where: {
              question_tournament_id: existingTournaments.map((t) => t.id),
            },
            transaction: t,
          });
          await QuestionTournament.destroy({
            where: { questions_id: question.id },
            transaction: t,
          });
        }

        await question.destroy({ transaction: t });
      });

      return h.response({ message: "Question has been deleted" }).code(200);
    } catch (error) {
      console.error(error);
      return h.response({ message: error.message }).code(500);
    }
  },
  checkAnswerPractice: async (request, h) => {
    try {
      const { Answer, id } = request.payload;
      const parsedId = parseInt(id, 10);
      if (isNaN(parsedId) || parsedId <= 0) {
        return h.response({ message: "Invalid question ID" }).code(400);
      }

      const question = await Question.findByPk(parsedId);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const existingTournament = await QuestionTournament.findOne({
        where: { questions_id: parsedId },
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

      if (correctAnswer !== Answer) {
        return h.response({ message: "Incorrect", solve: false }).code(200);
      }

      return await sequelize.transaction(async (t) => {
        let point = await Point.findOne({
          where: { users_id: user.user_id },
          transaction: t,
        });

        if (!point) {
          return h.response({ message: "Point not found" }).code(404);
        }

        if (user.role === "Admin") {
          return h.response({ message: "Correct", solve: true }).code(200);
        }

        const existingSubmission = await Submitted.findOne({
          where: {
            users_id: user.user_id,
            question_id: question.id,
          },
          attributes: ["question_id", "users_id"],
          raw: true,
          transaction: t,
        });

        if (existingSubmission) {
          return h
            .response({ message: "Already submitted", solve: true })
            .code(200);
        }

        await Submitted.create(
          {
            users_id: user.user_id,
            question_id: question.id,
          },
          { transaction: t }
        );

        point.points += question.point;
        await point.save({ transaction: t });

        return h.response({ message: "Correct", solve: true }).code(200);
      });
    } catch (err) {
      return h.response({ message: "Internal Server Error" }).code(500);
    }
  },

  checkAnswerTournament: async (request, h) => {
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

      const tournament = await Tournaments.findByPk(tournamentId);
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
        return h
          .response({
            message: Answer === correctAnswer ? "Correct" : "Incorrect",
            solve: Answer === correctAnswer,
          })
          .code(200);
      }

      return await sequelize.transaction(async (t) => {
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
          transaction: t,
        });

        if (!UserTeam) {
          return h
            .response({ message: "User not in this tournament" })
            .code(404);
        }

        let point = await TournamentPoints.findOne({
          where: {
            users_id: UserTeam.users_id,
            tournament_id: tournamentId,
            team_id: UserTeam.team_id,
          },
          transaction: t,
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
          transaction: t,
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
            { transaction: t }
          );

          point.points += question.Question.point;
          await point.save({ transaction: t });

          let teamScore = await TeamScores.findOne({
            where: { team_id: UserTeam.team_id, tournament_id: tournamentId },
            transaction: t,
          });

          if (!teamScore) {
            return h.response({ message: "Team score not found" }).code(404);
          }

          teamScore.total_points += question.Question.point;
          await teamScore.save({ transaction: t });

          return h.response({ message: "Correct", solve: true }).code(200);
        } else {
          return h.response({ message: "Incorrect", solve: false }).code(200);
        }
      });
    } catch (err) {
      return h.response({ message: "Internal Server Error" }).code(500);
    }
  },

  downloadFile: async (request, h) => {
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

      const question = await Question.findByPk(questionId);
      if (!question) {
        return h.response({ message: "Question not found" }).code(404);
      }

      if (!question.file_path) {
        return h
          .response({ message: "No file available for this question" })
          .code(400);
      }

      const questionTournament = await QuestionTournament.findOne({
        where: { questions_id: questionId },
      });

      if (questionTournament && user.role !== "Admin" && !tournament_id) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      if (tournament_id) {
        const tournamentId = parseInt(tournament_id, 10);

        if (isNaN(tournamentId) || tournamentId <= 0) {
          return h.response({ message: "Invalid tournament ID" }).code(400);
        }

        const tournament = await Tournaments.findByPk(tournamentId);
        if (!tournament) {
          return h.response({ message: "Tournament not found" }).code(404);
        }

        const currentTime = moment.tz("Asia/Bangkok").utc().toDate();

        if (currentTime > tournament.event_endDate) {
          return h.response({ message: "Tournament has ended" }).code(400);
        }

        if (currentTime < tournament.event_startDate) {
          return h
            .response({ message: "Tournament has not started" })
            .code(400);
        }

        const existingTournament = await QuestionTournament.findOne({
          where: { questions_id: questionId, tournament_id: tournamentId },
        });

        if (!existingTournament) {
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
          });

          if (!userTeam) {
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
        question.title,
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
      const { id, tournament_id } = request.query;
      const hintId = parseInt(id, 10);

      if (isNaN(hintId) || hintId <= 0) {
        return h.response({ message: "Invalid hint ID" }).code(400);
      }

      const token = request.state["cmu-oauth-token"];
      if (!token) {
        return h.response({ message: "Unauthorized" }).code(401);
      }

      const user = await authenticateUser(token);
      if (!user) {
        return h.response({ message: "User not found" }).code(404);
      }

      const hint = await Hint.findOne({ where: { id: hintId } });
      if (!hint) {
        return h.response({ message: "Hint not found" }).code(404);
      }

      if (user.role === "Admin") {
        return h.response({ data: hint.Description }).code(200);
      }

      let teamId = null;
      let pointsToUpdate = null;

      if (tournament_id) {
        const tournamentId = parseInt(tournament_id, 10);
        if (isNaN(tournamentId) || tournamentId <= 0) {
          return h.response({ message: "Invalid tournament ID" }).code(400);
        }

        const tournament = await Tournaments.findByPk(tournamentId);
        if (!tournament) {
          return h.response({ message: "Tournament not found" }).code(404);
        }

        const currentTime = moment.tz("Asia/Bangkok").utc().toDate();
        if (currentTime > tournament.event_endDate) {
          return h.response({ message: "Tournament has ended" }).code(400);
        }
        if (currentTime < tournament.event_startDate) {
          return h
            .response({ message: "Tournament has not started" })
            .code(400);
        }

        const existingTournament = await QuestionTournament.findOne({
          where: {
            questions_id: hint.question_id,
            tournament_id: tournamentId,
          },
        });

        if (!existingTournament) {
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
        });

        if (!userTeam) {
          return h
            .response({ message: "User not in this tournament" })
            .code(404);
        }

        teamId = userTeam.team_id;

        const existingHintUsedTournament = await HintUsed.findOne({
          where: { hint_id: hint.id, team_id: teamId },
        });

        if (existingHintUsedTournament) {
          return h.response({ data: hint.Description }).code(200);
        }

        pointsToUpdate = await TournamentPoints.findOne({
          where: { users_id: userTeam.users_id, tournament_id: tournamentId },
        });
      } else {
        const existingHintUsed = await HintUsed.findOne({
          where: { hint_id: hint.id, user_id: user.user_id, team_id: null },
        });

        if (existingHintUsed) {
          return h.response({ data: hint.Description }).code(200);
        }

        pointsToUpdate = await Point.findOne({
          where: { users_id: user.user_id },
        });
      }

      if (!pointsToUpdate) {
        return h.response({ message: "Point not found" }).code(404);
      }

      if (pointsToUpdate.points < hint.point) {
        return h.response({ message: "Not enough points" }).code(400);
      }

      const transaction = await sequelize.transaction();
      try {
        // ลดคะแนนของผู้ใช้
        pointsToUpdate.points -= hint.point;
        await pointsToUpdate.save({ transaction });

        // บันทึกว่าใช้ Hint แล้ว
        await HintUsed.create(
          {
            hint_id: hint.id,
            user_id: user.user_id,
            team_id: teamId,
          },
          { transaction }
        );

        await transaction.commit();
        return h
          .response({ message: "Hint used", data: hint.Description })
          .code(200);
      } catch (error) {
        await transaction.rollback();
        return h.response({ message: error.message }).code(500);
      }
    } catch (error) {
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
    attributes: {
      exclude: ["createdAt", "updatedAt"],
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

async function uploadFile(file, topic) {
  if (!file || !topic) return null;

  const allowedFileTypes = [
    "application/x-compressed",
    "application/x-zip-compressed",
    "application/gzip",
  ];

  if (!allowedFileTypes.includes(file.headers["content-type"])) {
    throw new Error("Invalid file type");
  }

  const topicDir = path.join(UPLOAD_DIR, topic);
  const filePath = path.join(topicDir, file.filename);

  try {
    await fs.promises.mkdir(topicDir, { recursive: true });
    await fs.promises.writeFile(
      filePath,
      await fs.promises.readFile(file.path)
    );
    return file.filename;
  } catch (err) {
    throw new Error("Failed to upload file");
  }
}

async function deleteFile(title) {
  if (!title) return;

  const folderPath = path.join(UPLOAD_DIR, title);

  try {
    const stat = await fs.promises.stat(folderPath);
    if (stat.isDirectory()) {
      const files = await fs.promises.readdir(folderPath);
      await Promise.all(
        files.map((file) => fs.promises.unlink(path.join(folderPath, file)))
      );
      await fs.promises.rmdir(folderPath);
    } else {
      console.log(`⚠️ ${folderPath} is not a folder`);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`⚠️ Folder not found: ${folderPath}`);
    } else {
      throw new Error("Failed to delete folder");
    }
  }
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

async function validateAndSanitizeHints(ArrayHint, question) {
  if (!ArrayHint || !Array.isArray(ArrayHint)) {
    return { error: "Invalid Hints format" };
  }

  if (ArrayHint.length > 3) {
    return { error: "Maximum 3 hints allowed" };
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
    return { error: "Invalid hint format. Hint must have detail and penalty" };
  }

  const descriptions = ArrayHint.map((hint) => hint.detail.trim());
  const uniqueDescriptions = new Set(descriptions);

  if (descriptions.length !== uniqueDescriptions.size) {
    return { error: "Duplicate hint descriptions found in the request." };
  }

  const sanitizedHints = ArrayHint.map((hint) => ({
    question_id: question.id,
    Description: xss(hint.detail),
    point: parseInt(hint.penalty, 10),
  }));

  const totalPenalty = sanitizedHints.reduce(
    (sum, curr) => sum + curr.point,
    0
  );

  if (totalPenalty > question.point) {
    return { error: "Total penalty exceeds point" };
  }

  return { sanitizedHints };
}

module.exports = questionController;
