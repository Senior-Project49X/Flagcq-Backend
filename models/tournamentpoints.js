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
        autoIncrement: true, // Add auto-increment here
      },
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
      },
      tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Tournament",
          key: "id",
        },
      },
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 0, // Default points set to 0
      },
    },
    {
      tableName: "TournamentPoints",
      timestamps: true,
    }
  );

  TournamentPoints.associate = function (models) {
    TournamentPoints.belongsTo(models.User, {
      foreignKey: "users_id",
      as: "user",
    });
    TournamentPoints.belongsTo(models.Tournament, {
      foreignKey: "tournament_id",
      as: "tournament",
    });
  };

  return TournamentPoints;
};
