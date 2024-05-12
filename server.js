const fs = require("fs");
const http = require("http");
const express = require("express");
var cors = require("cors");
const bodyParser = require("body-parser");
const compression = require('compression');

require("dotenv").config();

const app = express();
app.set("view engine", "ejs");
app.use(cors());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: true }));

//// STORE ---------------------------------------------------------------------

let games = {};

class Game {

    name;

    p1joined = false;
    p2joined = false;

    p1x = 0;
    p1y = 1000; // 1000 is offscreen
    p2x = 0;
    p2y = 1000;

    p1alive;
    p2alive;

    p1LastUpdated = new Date();
    p2LastUpdated = new Date();

    constructor(name) {
      this.name = name;
    }

    getOthersData(playerNum) {
        if (playerNum == 1) {
            return {
            x: this.p1x,
            y: this.p1y,
            alive: this.p1alive
            }
        } else {
            return {
            x: this.p2x,
            y: this.p2y,
            alive: this.p2alive
            }
        }
    }

    setPlayerData(playerNum, x, y, alive) {
        if (playerNum == 1) {
            this.p1x = x;
            this.p1y = y;
            this.p1alive = alive;
            this.p1LastUpdated = new Date();
        } else {
            this.p2x = x;
            this.p2y = y;
            this.p2alive = alive;
            this.p2LastUpdated = new Date();
        }
    }

    attemptJoin() {
        if (this.p1joined == false) {
            this.p1joined = true;
            return 1;
        } else if (this.p2joined == false) {
            this.p2joined = true;
            return 2;
        } else {
            return 0;
        }
    }

    isGameReady() {
        return this.p1joined && this.p2joined;
    }

    destroy() {
        games.delete(this.name);
    }

  }

//// SERVER VARIABLES ----------------------------------------------------------



//// API -----------------------------------------------------------------------

// Reception page
app.get("/", async (req, res) => {
    res.send("Backend Multiplayer Server and API for Jesuit Highschool Computer Science Project 2024.");
});

// Attempt to join a game or create a new game if the game does not exist. We must call attemptJoin() regardless.
app.get("/api/join/:name", async (req, res) => {
    const name = req.params.name;
    if (games[name] == null) {
        games[name] = new Game(name);
    }
    console.log("joined");
    res.send(games[name].attemptJoin().toString());
});

// Get the data of the other player
app.get("/api/get/:name/:playerNum", async (req, res) => {
    console.log("getting "+req.params.playerNum)
    const name = req.params.name;
    const playerNum = req.params.playerNum;
    const game = games[name];
    if (game == null) {
        res.send("0");
    } else {
        let odata = game.getOthersData(playerNum);
        res.send(odata.x + "," + odata.y + "," + odata.alive);
    }
});

// Set the data of the player
app.get("/api/set/:name/:playerNum/:x/:y/:alive", async (req, res) => {
    const name = req.params.name;
    const playerNum = req.params.playerNum;
    const x = req.params.x;
    const y = req.params.y;
    const alive = req.params.alive;
    const game = games[name];
    if (game == null) {
        res.send("0");
    } else {
        game.setPlayerData(parseInt(playerNum), parseInt(x), parseInt(y), alive == "true");
        res.send("1");
    }
});

// Check if the game is ready
app.get("/api/ready/:name", async (req, res) => {
    const name = req.params.name;
    const game = games[name];
    if (game == null) {
        res.send("0");
    } else {
        if (game.isGameReady()) {
            res.send("1");
        } else {
            res.send("0");
        }
    }
});

// Destroy the game
app.get("/api/destroy/:name", async (req, res) => {
    const name = req.params.name;
    const game = games[name];
    if (game == null) {
        res.send("0");
    } else {
        game.destroy();
        res.send("1");
    }
});

//// SERVER SETUP --------------------------------------------------------------

setInterval(() => {
    console.log(games)
    const now = new Date();
    for (const game of Object.values(games)) {
        if (now - game.p1LastUpdated > 5000) {
            game.p1joined = false;
            game.p1y = 1000;
            game.p1x = 0;
        }
        if (now - game.p2LastUpdated > 5000) {
            game.p2joined = false;
            game.p2y = 1000;
            game.p2x = 0;
        }
    }
}, 5000);

// Create HTTPS server
const options = {
    key: fs.readFileSync("private.key"),
    cert: fs.readFileSync("certificate.crt"),
};

const PORT = 9898;

//const server = https.createServer(options, app);

const server = http.createServer(app);

// If user connects to the server on this port from HTTP, redirect them to HTTPS

// const http = express();
// http.get("*", (req, res) => {
//     res.redirect("https://" + req.headers.host + req.url);
// });

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
