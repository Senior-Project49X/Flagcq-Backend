"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const User = sequelize.define(
    "User",
    {
      user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
      },
      student_id: {
        type: DataTypes.INTEGER,
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      faculty: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      AccType: {
        type: DataTypes.ENUM("StdAcc", "MISEmpAcc"),
        allowNull: false,
      },
    },
    {
      tableName: "Users",
      timestamps: true,
    }
  );

  User.associate = function (models) {
    User.hasMany(models.Point, { foreignKey: "users_id" });
    User.hasMany(models.Submited, { foreignKey: "users_id" });
    User.hasMany(models.TournamentPoints, { foreignKey: "users_id" });
    User.belongsToMany(models.Team, {
      through: models.Users_Team,
      foreignKey: "users_id",
    });
  };

  return User;
};
