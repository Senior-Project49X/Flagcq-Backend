"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Modes", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
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

    await queryInterface.addIndex("Modes", ["name"], {
      unique: true,
      name: "Modes_name",
    });

    await queryInterface.bulkInsert("Modes", [
      {
        name: "Practice",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "None",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Modes", "Modes_name");
    await queryInterface.dropTable("Modes");
  },
};
