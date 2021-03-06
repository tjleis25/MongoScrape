require('dotenv').config();
var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");
var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");
var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

//handlebars
app.engine("handlebars", exphbs ({
    defaultLayout: "main"
}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/mongoScrape";

mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, {                 useNewUrlParser: true 
})
.then(connection => {
    console.log('Connected to MongoDB');
})
.catch(err => {
    console.log(err.message);
});

//Routes
// =======================================
// Main Route
app.get("/", function (req, res) {
  db.Article.find({})
    .then(function (articles) {
      res.render("index", {
        articles: articles
      });
    })
    .catch(function (err) {
      res.json(err);
    })
})

// A GET route for scraping the espn website
app.get("/scrape", function(req, res) {
  
  axios.get("http://www.espn.com/").then(function(response) {
   
    var $ = cheerio.load(response.data);

    $("article h2").each(function(i, element) {
      // Save an empty result object
      var result = {};

      result.title = $(this)
        .children("a")
        .text();
      result.link = $(this)
        .children("a")
        .attr("href");

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticle) { 
          console.log(dbArticle);
        })
        .catch(function(err) { 
          return res.json(err);
        });
    });

    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  
  db.Article.find({})
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  db.Article.findOne({ _id: req.params.id })
    .populate("note")
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  db.Note.create(req.body)
    .then(function(dbNote) {
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});

// Delete Note from the DB
app.delete("/article/:articleid/note/:id", function(req, res) {
  db.Note.deleteOne(
      {_id: req.params.id}
    ).then(function(result){
      console.log(req.params.id)
      return db.Article.updateOne(
        {id:mongoose.Types.ObjectId(req.params.noteid)
        }, 
        {$pull: 
          {"note": 
            {
              _id: mongoose.Types.ObjectId(req.params.noteid)
            }
          }
        })
    }).then(function(dbNote){
      console.log(dbNote);
      res.json(dbNote);
    });
});

// Start the server
app.listen(process.env.PORT || 3000);
  

