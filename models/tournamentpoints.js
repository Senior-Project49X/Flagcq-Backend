"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TournamentPoints = sequelize.define(
    "TournamentPoints",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
      },
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "TournamentPoints",
      timestamps: true,
    }
  );

  return TournamentPoints;
};
