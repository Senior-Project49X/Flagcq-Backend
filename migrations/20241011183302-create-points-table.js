'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Points', {
      users_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      current_submit: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });

    await queryInterface.addConstraint('Points', {
      fields: ['users_id'],
      type: 'foreign key',
      name: 'FK_Points_users_id',
      references: {
        table: 'Users',
        field: 'user_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Points');
  }
};
