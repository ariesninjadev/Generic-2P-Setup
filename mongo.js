const mongoose = require("mongoose");

mongoose.set("strictQuery", true);
mongoose.connect(
    process.env.MONGO_URI
);

function randHex(len) {
    let result = '';
    const characters = '0123456789abcdef';
    const charactersLength = characters.length;
    for (let i = 0; i < len; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  // Function to get a random string of capital letters and numbers.
function randString(len) {
    let result = '';
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const charactersLength = characters.length;
    for (let i = 0; i < len; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  // Function to get a random string of numbers.
function randNum(len) {
    let result = '';
    const characters = '0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < len; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

const userSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        invite_id: { type: String, required: true },
        access_token: { type: String, required: true },
        pin: { type: String, required: false },
        emergency_code: { type: String, required: true },
        email: { type: String, required: true },
        name: { type: String, required: true },
        onboarded: { type: Boolean, required: true, default: false },
        security_sync: { type: Number, required: true },
    },
    { collection: "users" }
);

const gameSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        name: { type: String, required: true },
        desc: { type: String, required: true },
        img: { type: String, required: true },
        link: { type: String, required: true },
        badge: { type: String, required: false },
        color: { type: String, required: false },
        likes: { type: Number, required: true },
        order: { type: Number, required: true },
    },
    { collection: "games" }
);

const stateSchema = new mongoose.Schema(
    {
        security_layer: { type: Number, required: true },
    },
    { collection: "state" }
);

const User = mongoose.model("users", userSchema);
const Game = mongoose.model("games", gameSchema);
const State = mongoose.model("state", stateSchema);


// Function to register a new user. If the user already exists, return false.
async function registerUser(email, name) {
    console.log(email);
    console.log(name);
    const user = await User.findOne({ email: email });
    if (user) {
        return false;
    }
    // Set the user's name and email. Also, find security_sync from the state collection.
    const state = await State.findOne();
    const newUser = new User({
        email: email,
        name: name,
        id: randHex(16),
        invite_id:  randHex(6).toUpperCase(),
        access_token: 'CDAT-'+randNum(4)+'-'+randNum(4),
        emergency_code: randString(24),
        security_sync: state.security_layer,
    });
    await newUser.save();
    return newUser;
}

// Check if an email exists in the database. If it does, return the user object. If not, return false.
async function emailExists(email) {
    const user = await User.findOne({ email: email });
    if (user) {
        return user;
    }
    return false;
}

// Handle a phase 1 login. An email is provided. If the user does not exist, return false. If onboarding is false, return { "msg": "onboarding" }. If onboarding is true, return { "msg": "success" }
async function phase1Login(email) {
    const user = await User.findOne({ email: email });
    if (!user) {
        return false;
    }
    if (!user.onboarded) {
        return { msg: "onboarding" };
    }
    return { msg: "success" };
}

// Handle a phase 2 login. An email and pin are provided. If the user does not exist, return false. If the pin is incorrect, return { "msg": "incorrect" }. If the pin is correct, return the user object.
// If security_sync is not equal to the state's security_layer, return { "msg": "sync" }
async function phase2Login(email, pin) {
    const user = await User.findOne({ email: email });
    if (!user) {
        return false;
    }
    if (user.pin !== pin) {
        return { msg: "incorrect" };
    }
    if (user.security_sync !== (await State.findOne()).security_layer) {
        return { msg: "sync" };
    }
    return user;
}

// Set a users pin and onboard them.
async function onboardUser(email, pin) {
    const user = await User.findOne({ email: email });
    if (!user) {
        return false;
    }
    user.pin = pin;
    user.onboarded = true;
    await user.save();
    return true;
}

// Sync to the security layer. If the user's security_sync is equal to the state's security_layer, return false. If the user does not exist, return false. If the user provides the correct emergency code, update the security_sync, regenerate the emergency code, and return the new emergency code.
async function syncToSecurityLayer(email, emergencyCode) {
    const user = await User.findOne({ email: email });
    if (!user) {
        return false;
    }
    if (user.security_sync === (await State.findOne()).security_layer) {
        return false;
    }
    if (user.emergency_code !== emergencyCode) {
        return { msg: "incorrect" };
    }
    user.security_sync = (await State.findOne()).security_layer;
    user.emergency_code = randString(24);
    await user.save();
    return user.emergency_code;
}

// Function to fetch all games. Return the data and the revision number.
async function fetchAllGames() {
    const games = await Game.find();
    // Sort the games by their order. 0 is the first game, 1 is the second game, etc.
    games.sort((a, b) => a.order - b.order);
    return { data: games, revision: await State.findOne().revision };
}

async function urlToGameId(url) {
    // Ensure the URL is in the correct format. If not, format it. URL should be in the format "https://<game>.aries.ninja/"
    if (!url.startsWith("https://")) {
        url = "https://" + url;
    }
    if (!url.endsWith("/")) {
        url += "/";
    }
    const game = await Game.findOne({ link: url });
    if (!game) {
        return false;
    }
    return game.id;
}

// Function to get all users by a keyword. If the keyword is "[]", return all users.
// Search emails AND names. Should also be case-insensitive. Finally, sort by alphabetical order,
// first name to last name.
async function getUsersByKeyword(keyword) {
    if (keyword === "[]") {
        return await User.find().sort({ name: 1 });
    }
    // Escape the keyword to prevent regex injection.
    keyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    return await User.find({
        $or: [
            { email: { $regex: keyword, $options: "i" } },
            { name: { $regex: keyword, $options: "i" } },
        ],
    }).sort({ name: 1 });
}

// Delete a user by their email. If the user does not exist, return false.
async function deleteUser(email) {
    const user = await User.findOne({ email: email });
    if (!user) {
        return false;
    }
    await User.deleteOne({ email: email });
    return true;
}




console.log("Thread > DB Connected on MAIN");

module.exports = {
    registerUser,
    emailExists,
    fetchAllGames,
    urlToGameId,
    getUsersByKeyword,
    deleteUser,
    phase1Login,
    phase2Login,
    onboardUser,
    syncToSecurityLayer,
};

