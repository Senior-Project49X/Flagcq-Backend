"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Teams", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      tournament_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      invite_code: {
        type: Sequelize.STRING(8), // Length of 8 characters for the invite code
        allowNull: false,
        unique: true, // Ensure invite codes are unique
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add a unique index for name and tournament_id to ensure no duplicate team names within the same tournament
    await queryInterface.addIndex("Teams", ["name", "tournament_id"], {
      unique: true,
    });

    // Add foreign key constraint with ON DELETE CASCADE
    await queryInterface.addConstraint("Teams", {
      fields: ["tournament_id"],
      type: "foreign key",
      name: "FK_Teams_tournament_id",
      references: {
        table: "Tournament",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the Teams table and its constraints
    await queryInterface.dropTable("Teams");
  },
};
