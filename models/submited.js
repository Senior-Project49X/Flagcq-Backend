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
      },
      question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Questions",
          key: "id",
        },
      },
    },
    {
      tableName: "Submited",
      timestamps: false,
    }
  );

  return Submited;
};
