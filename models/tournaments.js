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
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      Decsription: {
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
