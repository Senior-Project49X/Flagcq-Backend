"use strict";

const { table } = require("console");
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TournamentSubmitted = sequelize.define(
    "TournamentSubmitted",
    {
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
        unique: "user_question_tournament_unique",
        primaryKey: true,
      },
      tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Tournament",
          key: "id",
        },
        unique: "user_question_tournament_unique",
        primaryKey: true,
      },
      question_tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "QuestionTournaments",
          key: "id",
        },
        unique: "user_question_tournament_unique",
        primaryKey: true,
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teams",
          key: "id",
        },
        unique: "user_question_tournament_unique",
        primaryKey: true,
      },
    },
    {
      tableName: "TournamentSubmitted",
      timestamps: true,
    }
  );

  TournamentSubmitted.associate = function (models) {
    TournamentSubmitted.belongsTo(models.User, { foreignKey: "users_id" });
    TournamentSubmitted.belongsTo(models.Tournament, {
      foreignKey: "tournament_id",
    });
    TournamentSubmitted.belongsTo(models.QuestionTournament, {
      foreignKey: "question_tournament_id",
    });
    TournamentSubmitted.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return TournamentSubmitted;
};
