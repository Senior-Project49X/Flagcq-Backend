"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const { log } = require("console");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/../config/config.js")[env];
const db = {};

let sequelize;

if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

const Category = require("./categories")(sequelize, Sequelize.DataTypes);
const Point = require("./points")(sequelize, Sequelize.DataTypes);
const Question = require("./questions")(sequelize, Sequelize.DataTypes);
const QuestionTournament = require("./questionstournament")(
  sequelize,
  Sequelize.DataTypes
);
const User = require("./users")(sequelize, Sequelize.DataTypes);
const Submited = require("./submited")(sequelize, Sequelize.DataTypes);
const Team = require("./teams")(sequelize, Sequelize.DataTypes);
const Users_Team = require("./users_team")(sequelize, Sequelize.DataTypes);
const TeamScores = require("./teamscores")(sequelize, Sequelize.DataTypes);
const Tournament = require("./tournaments")(sequelize, Sequelize.DataTypes);
const TournamentPoints = require("./tournamentpoints")(
  sequelize,
  Sequelize.DataTypes
);
const TournamentSubmited = require("./tournamentsubmited")(
  sequelize,
  Sequelize.DataTypes
);
const Hint = require("./hints")(sequelize, Sequelize.DataTypes);
const HintUsed = require("./hintused")(sequelize, Sequelize.DataTypes);

db.Category = Category;
db.Point = Point;
db.Question = Question;
db.QuestionTournament = QuestionTournament;
db.User = User;
db.Submited = Submited;
db.Team = Team;
db.Users_Team = Users_Team;
db.TeamScores = TeamScores;
db.Tournament = Tournament;
db.TournamentPoints = TournamentPoints;
db.TournamentSubmited = TournamentSubmited;
db.Hint = Hint;
db.HintUsed = HintUsed;

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      !file.startsWith(".") &&
      file !== basename &&
      file.endsWith(".js") &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(
      sequelize,
      Sequelize.DataTypes
    );
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
