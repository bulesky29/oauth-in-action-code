var express = require("express");
var bodyParser = require('body-parser');
var cons = require('consolidate');
var nosql = require('nosql').load('database.nosql');
var __ = require('underscore');
var cors = require('cors');

var app = express();

app.use(bodyParser.urlencoded({ extended: true })); // support form-encoded bodies (for bearer tokens)

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/protectedResource');
app.set('json spaces', 4);

app.use('/', express.static('files/protectedResource'));
app.use(cors());

var resource = {
	"name": "Protected Resource",
	"description": "This data has been protected by OAuth 2.0"
};

var getAccessToken = function(req, res, next) {
    var inToken = null;
    var auth = req.headers['authorization'];
    if (auth && auth.toLowerCase().indexOf('bearer') == 0) {
        inToken = auth.slice('bearer '.length);
    } else if (req.body && req.body.access_token) {
        inToken = req.body.access_token;
    } else if (req.query && req.query.access_token) {
        inToken = req.query.access_token;
    }

    console.log('Incoming token: %s', inToken);

    // MODIFICATION:
    // The original nosql.one() call can be sensitive to the state of the database file.
    // Using the find().where() builder pattern is more robust and declarative.
    nosql.find()
         .where('access_token', inToken)
         .first() // Ensures we get only one result, similar to .one()
         .callback(function(err, token) {
            if (err) {
                // It's good practice to handle database errors properly.
                console.error("Database error:", err);
                // Send a server error response and stop processing.
                res.status(500).end();
                return;
            }

            if (token) {
                console.log("Found a matching token object in DB: ", token);
            } else {
                console.log("No matching token was found for value: %s", inToken);
            }
            
            // Attach the found token (or null if not found) to the request object.
            req.access_token = token;
            next(); // Pass control to the next middleware/handler.
    });
};

app.options('/resource', cors());


/*
 * Add the getAccessToken function to this handler
 */
app.post("/resource", getAccessToken ,cors(), function(req, res){
	if (req.access_token){
		res.json(resource);
	}else{
		res.status(401).end();
	}
	
});

var server = app.listen(9002, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('OAuth Resource Server is listening at http://%s:%s', host, port);
});
 
