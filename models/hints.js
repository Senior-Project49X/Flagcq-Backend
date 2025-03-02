"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Hint = sequelize.define(
    "Hint",
    {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Questions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      Description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      point: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      tableName: "Hints",
      timestamps: true,
      uniqueKeys: {
        unique_hint: {
          fields: ["question_id", "hint"],
        },
      },
    }
  );

  Hint.associate = function (models) {
    Hint.belongsTo(models.Question, { foreignKey: "question_id" });
  };

  return Hint;
};
