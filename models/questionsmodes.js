"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const QuestionMode = sequelize.define(
    "QuestionMode",
    {
      questions_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Questions",
          key: "id",
        },
        unique: "question_mode_unique",
      },
      mode_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Modes",
          key: "id",
        },
        unique: "question_mode_unique",
      },
    },
    {
      tableName: "QuestionModes",
      timestamps: true,
    }
  );
  QuestionMode.associate = function (models) {
    QuestionMode.belongsTo(models.Question, { foreignKey: "questions_id" });
    QuestionMode.belongsTo(models.Mode, { foreignKey: "mode_id" });
  };

  return QuestionMode;
};
