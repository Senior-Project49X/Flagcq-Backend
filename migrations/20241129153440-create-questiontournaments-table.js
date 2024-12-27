"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      "QuestionTournaments",
      {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        questions_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Questions",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        tournament_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: "Tournament",
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
          unique_questions_tournament: {
            fields: ["questions_id", "tournament_id"],
          },
        },
      }
    );
    
  await queryInterface.addConstraint("QuestionTournaments", {
      fields: ["tournament_id"],
      type: "foreign key",
      name: "FK_TeamScores_tournament_id",
      references: {
        table: "Tournament",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
  });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("QuestionTournaments");
  },
};
