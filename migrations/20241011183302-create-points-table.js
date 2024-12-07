"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Points", {
      users_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      points: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addConstraint("Points", {
      fields: ["users_id"],
      type: "foreign key",
      name: "FK_Points_users_id",
      references: {
        table: "Users",
        field: "user_id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("Points", ["users_id"], {
      unique: true,
      name: "Points_users_id",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("Points", "Points_users_id");
    await queryInterface.dropTable("Points");
  },
};
