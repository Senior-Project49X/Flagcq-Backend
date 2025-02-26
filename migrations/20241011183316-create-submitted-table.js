"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      "Submitted",
      {
        users_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: "Users",
            key: "user_id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          primaryKey: true,
        },
        question_id: {
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
          unique_users_question: {
            fields: ["users_id", "question_id"],
          },
        },
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Submitted");
  },
};
