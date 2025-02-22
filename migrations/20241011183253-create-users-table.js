"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'
    );

    await queryInterface.createTable("Users", {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      student_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
      },
      itaccount: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      first_name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      last_name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      faculty: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      AccType: {
        type: Sequelize.ENUM("StdAcc", "MISEmpAcc", "AlumAcc"),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM("User", "Admin"),
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'DROP EXTENSION IF EXISTS "uuid-ossp"'
    );
    await queryInterface.dropTable("Users");
  },
};
