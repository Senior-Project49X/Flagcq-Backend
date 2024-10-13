"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Point = sequelize.define(
    "Point",
    {
      users_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
      },
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      current_submit: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "Points",
      timestamps: false,
    }
  );

  return Point;
};
