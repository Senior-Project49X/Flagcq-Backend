"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      CREATE TYPE "Question_type" AS ENUM (
        'Practice',
        'Tournament'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "AccountTypes" AS ENUM (
        'StdAcc',
        'MISEmpAcc'
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE TYPE "Difficulties" AS ENUM (
        'Easy',
        'Medium',
        'Hard'
      );
    `);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`DROP TYPE "Question_type";`);
    await queryInterface.sequelize.query(`DROP TYPE "AccountTypes";`);
    await queryInterface.sequelize.query(`DROP TYPE "Difficulties";`);
  },
};
