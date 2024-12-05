"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "TournamentSubmited",
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
        tournament_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Tournaments",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          primaryKey: true,
        },
        question_tournament_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "QuestionTournaments",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          primaryKey: true,
        },
        team_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Teams",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
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
          unique_users_tournament: {
            fields: [
              "users_id",
              "tournament_id",
              "question_tournament_id",
              "team_id",
            ],
          },
        },
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("TournamentSubmited");
  },
};
