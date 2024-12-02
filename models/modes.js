"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Mode = sequelize.define(
    "Mode",
    {
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
    },
    {
      tableName: "Modes",
      timestamps: true,
    }
  );

  return Mode;
};
