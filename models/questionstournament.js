"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const QuestionTournament = sequelize.define(
    "QuestionTournament",
    {
      questions_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Questions",
          key: "id",
        },
        unique: "question_tournament_unique",
      },
      tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Tournament",
          key: "id",
        },
        unique: "question_tournament_unique",
      },
    },
    {
      tableName: "QuestionTournaments",
      timestamps: true,
    }
  );

  QuestionTournament.associate = function (models) {
    QuestionTournament.belongsTo(models.Question, {
      foreignKey: "questions_id",
    });
    QuestionTournament.belongsTo(models.Tournament, {
      foreignKey: "tournament_id",
    });
    QuestionTournament.hasMany(models.TournamentSubmited, {
      foreignKey: "question_tournament_id",
    });
  };

  return QuestionTournament;
};
