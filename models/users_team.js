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
          model: "Users", // Table name for Users model
          key: "user_id", // Foreign key in Users table
        },
        onDelete: "CASCADE",
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teams", // Table name for Teams model
          key: "id", // Foreign key in Teams table
        },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "Users_Team",
      timestamps: true,
    }
  );

  // Associations
  Users_Team.associate = function (models) {
    Users_Team.belongsTo(models.User, {
      foreignKey: "users_id",
      as: "user", // Alias for user details
    });

    Users_Team.belongsTo(models.Team, {
      foreignKey: "team_id",
      as: "team", // Alias for the team details
    });
  };

  return Users_Team;
};
