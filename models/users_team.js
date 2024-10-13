"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Users_Team = sequelize.define(
    "Users_Team",
    {
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teams",
          key: "id",
        },
      },
    },
    {
      tableName: "Users_Team",
      timestamps: false,
    }
  );

  return Users_Team;
};
