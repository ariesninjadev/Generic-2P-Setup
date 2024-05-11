const fs = require("fs");
const path = require("path");
const https = require("https");
const express = require("express");
var cors = require("cors");
const { Level } = require("level");
const bodyParser = require("body-parser");
const session = require("express-session");

require("dotenv").config();

const DB = require("./mongo");

const app = express();
app.set("view engine", "ejs");
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    })
);

async function authenticate(req, res, next) {
    // If request header "X_CLIENT_USER" and "X_CLIENT_PASS" are set, use them for authentication
    if (
        req.headers["x-client-user"] === process.env.ADMIN_USR &&
        req.headers["x-client-pass"] === process.env.ADMIN_PWD
    ) {
        // If user is authenticated, proceed to the next middleware
        next();
    } else {
        // Get referrer URL from mongo and append /login to it
        const referrer = 'https://TEMPSITE.org/'
        const loginURL = `${referrer}admin/login`;
        // Redirect to login page
        res.status(403).send(`Unauthorized. Please login at ${loginURL}`);
    }
}

// app.get("/login", (req, res) => {
//     const errorMessage = req.session.errorMessage;
//     req.session.errorMessage = null; // Clear the error message
//     res.render("login", { errorMessage });
// });

// Handle login form submission
app.post("/login", (req, res) => {
    // Get username and password from query parameters
    const username = req.query.username;
    const password = req.query.password;

    // Check if username and password are correct
    if (
        username === process.env.ADMIN_USR &&
        password === process.env.ADMIN_PWD
    ) {
        console.log("User authenticated.");
        // If credentials are correct, set session authenticated flag to true
        req.session.authenticated = true;
        // Redirect to admin page
        res.status(200).send({ success: true });
    } else {
        // If credentials are incorrect, store the error message in session and redirect back to login page
        res.status(401).send({ success: false });
    }
});

//// STATIC -----------------------------------------------------------------------

// Serve the timer.js file
app.get("/static/timer.js", (req, res) => {
    try {
        // Use __dirname to get the absolute path to the file
        const filePath = __dirname + "/timer.js";
        // Send the file
        res.sendFile(filePath);
    } catch (err) {
        console.error("Error reading timer.js:", err);
        // Send an error response if something goes wrong
        res.status(500).send("Internal Server Error");
    }
});

// Serve minimal "hello" homepage
// app.get("/", (req, res) => {
//     res.send(
//         "You are on the Ninjaverse API. Most endpoints are protected. This is not intended for public use."
//     );
// });

//// ADMIN API -----------------------------------------------------------------------

// Test admin authentication
app.get("/api/admin/test", authenticate, (req, res) => {
    res.status(200).json({ success: true });
});

// Fetch all users
app.get("/api/admin/users", authenticate, async (req, res) => {
    var users = await DB.fetchAllUsers();
    res.json(users);
});

// Use getUsersByKeyword(keyword) to fetch users by keyword.
app.get("/api/admin/usersByQuery", authenticate, async (req, res) => {
    var users = await DB.getUsersByKeyword(req.query.keyword);
    res.json(users);
});

// Register a new user.
app.post("/api/admin/registerUser", authenticate, async (req, res) => {
    const registered = await DB.registerUser(req.query.email, req.query.name);
    if (registered) {
        res.status(200).send({ success: true });
    } else {
        res.status(409).send( { success: false });
    }
});

// Delete a user by email.
app.post("/api/admin/deleteUser", authenticate, async (req, res) => {
    const deleted = await DB.deleteUser(req.query.email);
    if (deleted) {
        res.status(200).send({ success: true });
    } else {
        res.status(204).send({ success: false });
    }
});

//// USER API -----------------------------------------------------------------------

// Fetch all games
app.get("/api/games/data", async (req, res) => {
    res.json(await DB.fetchAllGames());
});

// Handle a phase 1 sign in
app.post("/api/user/signIn", async (req, res) => {
    const signedIn = await DB.phase1login(req.query.email);
    if (!signedIn) {
        res.status(401).send({ success: false });
    } else {
        res.status(200).send(signedIn);
    }
});

// Handle a phase 2 sign in
app.post("/api/user/verify", async (req, res) => {
    const verified = await DB.phase2Login(req.query.email, req.query.pin);
    if (!verified) {
        res.status(401).send({ success: false });
    } else {
        res.status(200).send(verified);
    }
});

// Onboard a user
app.post("/api/user/onboard", async (req, res) => {
    const onboarded = await DB.onboardUser(req.query.email, req.query.pin);
    if (onboarded) {
        res.status(200).send({ success: true });
    } else {
        res.status(204).send({ success: false });
    }
});


//// GAMES API -----------------------------------------------------------------------

// Get a game Id by URL
app.get("/api/games/urlToId", async (req, res) => {
    const id = await DB.urlToGameId(req.query.url);
    if (id) {
        res.json({ id });
    } else {
        res.status(204).send({ success: false });
    }
});

//// GLOBAL API -----------------------------------------------------------------------

// Fetch referrer
app.get("/api/global/referrer", async (req, res) => {
    res.json({ referrer: await DB.fetchReferrer() });
});

// Fetch timer status
app.get("/api/global/timer", async (req, res) => {
    res.json({ enabled: await DB.fetchTimerEnabled() });
});

//// SERVER SETUP -----------------------------------------------------------------------

// Create HTTPS server
const options = {
    key: fs.readFileSync("private.key"),
    cert: fs.readFileSync("certificate.crt"),
};

const PORT = 11420;

const server = https.createServer(options, app);

// If user connects to the server on this port from HTTP, redirect them to HTTPS

const http = express();
http.get("*", (req, res) => {
    res.redirect("https://" + req.headers.host + req.url);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
