"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "Hints",
      {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
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
        },
        Description: {
          type: Sequelize.STRING(100),
          allowNull: false,
        },
        point: {
          type: Sequelize.INTEGER,
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
      },
      {
        uniqueKeys: {
          unique_hint: {
            fields: ["question_id", "Description"],
          },
        },
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Hints");
  },
};
