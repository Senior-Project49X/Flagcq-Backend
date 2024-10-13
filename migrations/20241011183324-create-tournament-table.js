'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Tournament', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      enroll_startDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      enroll_endDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      event_startDate: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      event_endDate: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Tournament');
  }
};
