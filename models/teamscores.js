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
      },
      team_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Teams",
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
    TeamScores.belongsTo(models.Team, { foreignKey: "team_id" });
  };

  return TeamScores;
};
