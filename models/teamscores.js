"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const TeamScores = sequelize.define(
    "TeamScores",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true, // Automatically increment ID
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teams",
          key: "id",
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
      total_points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      tableName: "TeamScores",
      timestamps: true,
    }
  );

  TeamScores.associate = function (models) {
    TeamScores.belongsTo(models.Team, { 
      foreignKey: "team_id",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
     });
    TeamScores.belongsTo(models.Tournament, { foreignKey: "tournament_id" });
  };

  return TeamScores;
};
