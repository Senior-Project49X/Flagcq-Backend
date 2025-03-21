"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Submitted = sequelize.define(
    "Submitted",
    {
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
        unique: "user_question_unique",
        primaryKey: true,
      },
      question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Questions",
          key: "id",
        },
        unique: "user_question_unique",
        primaryKey: true,
      },
    },
    {
      tableName: "Submitted",
      timestamps: true,
    }
  );

  Submitted.associate = function (models) {
    Submitted.belongsTo(models.User, { foreignKey: "users_id" });
    Submitted.belongsTo(models.Question, { foreignKey: "question_id" });
  };

  return Submitted;
};
