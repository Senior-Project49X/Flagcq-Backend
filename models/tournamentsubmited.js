"use strict";

const { table } = require("console");
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TournamentSubmited = sequelize.define(
    "TournamentSubmited",
    {
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
        unique: "user_question_tournament_unique",
      },
      tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Tournament",
          key: "id",
        },
        unique: "user_question_tournament_unique",
      },
      question_tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "QuestionTournaments",
          key: "id",
        },
        unique: "user_question_tournament_unique",
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teams",
          key: "id",
        },
        unique: "user_question_tournament_unique",
      },
    },
    {
      table: "TournamentSubmited",
      timestamps: true,
    }
  );

  TournamentSubmited.associate = function (models) {
    TournamentSubmited.belongsTo(models.User, { foreignKey: "users_id" });
    TournamentSubmited.belongsTo(models.Tournament, {
      foreignKey: "tournament_id",
    });
    TournamentSubmited.belongsTo(models.QuestionTournament, {
      foreignKey: "question_tournament_id",
    });
    TournamentSubmited.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return TournamentSubmited;
};
