"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      student_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
      },
      itaccount: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      first_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      faculty: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      AccType: {
        type: DataTypes.ENUM("StdAcc", "MISEmpAcc"),
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM("User", "Admin"),
        allowNull: false,
      },
    },
    {
      tableName: "Users",
      timestamps: true,
    }
  );

  User.associate = function (models) {
    User.hasMany(models.Point, { foreignKey: "users_id" });
    User.hasMany(models.Submitted, { foreignKey: "users_id" });
    User.hasMany(models.TournamentPoints, {
      foreignKey: "users_id",
      as: "tournamentPoints",
    });
    User.belongsToMany(models.Team, {
      through: models.Users_Team,
      foreignKey: "users_id",
      otherKey: "team_id",
      as: "teams", // Alias for teams the user belongs to
    });

    User.hasMany(models.Users_Team, {
      foreignKey: "users_id",
      as: "usersTeams", // Alias to reference this association
    });

    User.hasMany(models.TournamentSubmitted, {
      foreignKey: "users_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  };

  return User;
};
