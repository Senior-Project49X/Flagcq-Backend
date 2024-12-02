"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Categories", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(20),
        allowNull: false,
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

    await queryInterface.addIndex("Categories", ["name"], {
      unique: true,
      name: "Categories_name",
    });

    await queryInterface.bulkInsert("Categories", [
      {
        name: "General Skill",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Crytography",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Network",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Forensics",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Categories", "Categories_name");
    await queryInterface.dropTable("Categories");
  },
};
