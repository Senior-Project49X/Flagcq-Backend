const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const HintUsed = sequelize.define(
    "HintUsed",
    {
      hint_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Hints",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        unique: "unique_hint_used",
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "user_id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        unique: "unique_hint_used",
      },
    },
    {
      tableName: "Hint_Used",
      timestamps: true,
    }
  );

  HintUsed.associate = function (models) {
    HintUsed.belongsTo(models.Hint, { foreignKey: "hint_id" });
    HintUsed.belongsTo(models.User, { foreignKey: "user_id" });
  };

  return HintUsed;
};
