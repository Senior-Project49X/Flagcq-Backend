"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Users", {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      faculty: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      AccType: {
        type: Sequelize.ENUM("StdAcc", "MISEmpAcc"),
        allowNull: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("Users");
  },
};
