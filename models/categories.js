"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Category = sequelize.define(
    "Category",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
    },
    {
      tableName: "Categories",
      timestamps: true,
    }
  );

  return Category;
};
