"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("TournamentPoints", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true, // Add auto-increment
        primaryKey: true,
      },
      users_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      tournament_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      team_id: {
        // 👈 เพิ่ม team_id ตรงนี้
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      points: {
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

    await queryInterface.addConstraint("TournamentPoints", {
      fields: ["users_id"],
      type: "foreign key",
      name: "FK_TournamentPoints_users_id",
      references: {
        table: "Users",
        field: "user_id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("TournamentPoints", {
      fields: ["tournament_id"],
      type: "foreign key",
      name: "FK_TournamentPoints_tournament_id",
      references: {
        table: "Tournament",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("TournamentPoints", {
      fields: ["team_id"], // 👈 เพิ่ม FK ของ team_id
      type: "foreign key",
      name: "FK_TournamentPoints_team_id",
      references: {
        table: "Teams",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("TournamentPoints");
  },
};
