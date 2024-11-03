"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("TeamScores", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      tournament_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      total_points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addConstraint("TeamScores", {
      fields: ["team_id"],
      type: "foreign key",
      name: "FK_TeamScores_team_id",
      references: {
        table: "Teams",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("TeamScores", {
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
    await queryInterface.dropTable("TeamScores");
  },
};
