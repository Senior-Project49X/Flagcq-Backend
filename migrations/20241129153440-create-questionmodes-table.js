"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      "QuestionModes",
      {
        questions_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Questions",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          primaryKey: true,
        },
        mode_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Modes",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          primaryKey: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      },
      {
        uniqueKeys: {
          unique_questions_mode: {
            fields: ["questions_id", "mode_id"],
          },
        },
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("QuestionModes");
  },
};
