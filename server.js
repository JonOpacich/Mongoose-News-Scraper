let express = require("express");
let bodyParser = require("body-parser");
let logger = require("morgan");
let mongoose = require("mongoose");
let path = require('path');
// Our scraping tools
// request is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
let request = require("request");
let cheerio = require("cheerio");

// Require all models
let db = require("./models");

let PORT = process.env.PORT || 3000;

// Initialize Express
let app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));


// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoHeadlines";

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);



app.get('/', function(req, res) {
  res.sendFile('index.html');
});
// A GET route for scraping the echoJS website
app.get("/articles", function(req, res) {
  // First, we grab the body of the html with request
  db.Article.init().then(function() {
    request("https://www.bbc.com/", function(error, response, body) {
      // Then, we load that into cheerio and save it to $ for a shorthand selector
      let $ = cheerio.load(body);

      // Now, we grab every h2 within an article tag, and do the following:
      $("a.media__link").each(function(i, element) {
        // Save an empty result object
        let result = {};

        // Add the text and href of every link, and save them as properties of the result object
        result.title = $(element).text();
        result.link = $(element).attr("href");
        result.summary = $(element)
          .parent()
          .siblings("p.media__summary")
          .text()
          .trim();

        // Create a new Article using the `result` object built from scraping

        db.Article.create(result, function(error) {});
      });

      // If we were able to successfully scrape and save an Article, send a message to the client
      db.Article.find({})
        .then(function(dbArticle) {
          // If we were able to successfully find Articles, send them back to the client
          res.json(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, send it to the client
          res.json(err);
        });
    });
  });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate(
        { _id: req.params.id },
        { note: dbNote._id },
        { new: true }
      );
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
