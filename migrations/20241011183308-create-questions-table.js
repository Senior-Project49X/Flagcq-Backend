"use strict";

const { Tournament } = require("../models");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Questions", {
      categories_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      title: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true,
      },
      Description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      Answer: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      point: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      difficulty_id: {
        type: Sequelize.ENUM("Easy", "Medium", "Hard"),
        allowNull: false,
      },
      file_path: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      Practice: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      Tournament: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addConstraint("Questions", {
      fields: ["categories_id"],
      type: "foreign key",
      name: "FK_Questions_categories_id",
      references: {
        table: "Categories",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("Questions", ["categories_id"], {
      name: "Questions_categories_id_index",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "Questions",
      "Questions_categories_id_index"
    );
    await queryInterface.dropTable("Questions");
  },
};
