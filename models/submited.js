"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Submited = sequelize.define(
    "Submited",
    {
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
        unique: "user_question_unique",
      },
      question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Questions",
          key: "id",
        },
        unique: "user_question_unique",
      },
    },
    {
      tableName: "Submited",
      timestamps: true,
    }
  );

  Submited.associate = function (models) {
    Submited.belongsTo(models.User, { foreignKey: "user_id" });
    Submited.belongsTo(models.Question, { foreignKey: "question_id" });
  };

  return Submited;
};
