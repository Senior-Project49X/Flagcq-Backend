"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TYPE "AccountTypes" AS ENUM (
        'StdAcc',
        'MISEmpAcc'
        'AlumAcc'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "Difficulties" AS ENUM (
        'Easy',
        'Medium',
        'Hard'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "Role" AS ENUM (
        'User',
        'Admin'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "Mode" AS ENUM (
        'Public',
        'Private'
      );
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP TYPE "AccountTypes";`);
    await queryInterface.sequelize.query(`DROP TYPE "Difficulties";`);
  },
};
