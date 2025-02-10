"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Tournament = sequelize.define(
    "Tournament",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      enroll_startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      enroll_endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      event_startDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      event_endDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      mode: {
        type: DataTypes.ENUM('Public', 'Private'),
        allowNull: false,
      },
      teamSizeLimit: {
        type: DataTypes.INTEGER,
        allowNull: true, // Only applicable for public tournaments
      },
      teamLimit: {
        type: DataTypes.INTEGER,
        allowNull: true, // Only applicable for public tournaments
      },
      playerLimit: {
        type: DataTypes.INTEGER,
        allowNull: true, // Only applicable for private tournaments
      },
      joinCode: {
        type: DataTypes.STRING(6),
        allowNull: true, // Only applicable for private tournaments
        unique: true,
      },
    },
    {
      tableName: "Tournament",
      timestamps: true,
    }
  );

  Tournament.associate = function (models) {
    Tournament.hasMany(models.Team, { foreignKey: "tournament_id" });
    Tournament.hasMany(models.TournamentPoints, {
      foreignKey: "tournament_id",
    });
    Tournament.hasMany(models.TeamScores, { foreignKey: "tournament_id" });
  };

  return Tournament;
};