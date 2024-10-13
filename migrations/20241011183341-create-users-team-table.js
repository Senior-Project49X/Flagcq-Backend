"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users_Team", {
      users_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      team_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint("Users_Team", {
      fields: ["users_id"],
      type: "foreign key",
      name: "FK_Users_Team_users_id",
      references: {
        table: "Users",
        field: "user_id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("Users_Team", {
      fields: ["team_id"],
      type: "foreign key",
      name: "FK_Users_Team_team_id",
      references: {
        table: "Teams",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Users_Team");
  },
};
