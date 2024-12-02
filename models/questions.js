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
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      Answer: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      point: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      difficultys_id: {
        type: DataTypes.ENUM("Easy", "Medium", "Hard"),
        allowNull: false,
      },
      file_path: {
        type: DataTypes.STRING(500),
        unique: true,
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
    Question.hasMany(models.Submited, { foreignKey: "question_id" });
  };

  return Question;
};
