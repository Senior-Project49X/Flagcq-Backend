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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now"),
      },
    });

    await queryInterface.addIndex("Teams", ["name", "tournament_id"], {
      unique: true,
    });

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
    await queryInterface.dropTable("Teams");
  },
};
