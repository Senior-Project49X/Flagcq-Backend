"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Team = sequelize.define(
    "Team",
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
      tournament_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Tournament",
          key: "id",
        },
      },
      invite_code: {
        type: DataTypes.STRING(10), // Store invite codes
        allowNull: false,
        unique: true,
      },
    },
    {
      tableName: "Teams",
      timestamps: true,
    }
  );

  Team.associate = function (models) {
    Team.belongsTo(models.Tournament, { foreignKey: "tournament_id" });
    Team.belongsToMany(models.User, {
      through: models.Users_Team,
      foreignKey: "team_id",
    });
    Team.hasMany(models.TeamScores, { foreignKey: "team_id" });
  };

  return Team;
};
