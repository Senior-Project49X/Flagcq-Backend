"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Question = sequelize.define(
    "Question",
    {
      categories_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      title: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      Description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      Answer: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      point: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      difficulty_id: {
        type: DataTypes.ENUM("Easy", "Medium", "Hard"),
        allowNull: false,
      },
      file_path: {
        type: DataTypes.STRING(500),
        unique: true,
      },
      Practice: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      Tournament: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdBy: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
    },
    {
      tableName: "Questions",
      timestamps: true,
    }
  );

  Question.associate = function (models) {
    Question.belongsTo(models.Category, { foreignKey: "categories_id" });
    Question.hasMany(models.Submitted, { foreignKey: "question_id" });
    Question.hasMany(models.QuestionTournament, { foreignKey: "questions_id" });
  };

  return Question;
};
