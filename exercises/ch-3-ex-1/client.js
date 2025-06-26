var express = require("express");
var request = require("sync-request");
var url = require("url");
var qs = require("qs");
var querystring = require('querystring');
var cons = require('consolidate');
var randomstring = require("randomstring");
var __ = require('underscore');
const { log } = require("console");
__.string = require('underscore.string');

var app = express();

app.engine('html', cons.underscore);
app.set('view engine', 'html');
app.set('views', 'files/client');

// authorization server information
var authServer = {
	authorizationEndpoint: 'http://localhost:9001/authorize',
	tokenEndpoint: 'http://localhost:9001/token'
};

// client information


/*
 * Add the client information in here
 */
var client = {
	"client_id": "oauth-client-1",
	"client_secret": "oauth-client-secret-1",
	"redirect_uris": ["http://localhost:9000/callback"]
};

var protectedResource = 'http://localhost:9002/resource';

var state = null;

var access_token = null;
var scope = null;

app.get('/', function (req, res) {
	res.render('index', {access_token: access_token, scope: scope});
});

app.get('/authorize', function(req, res){
	var buildUrl = function(base, options, hash){
		var newUrl = url.parse(base,true);
		delete newUrl.search;
		if (!newUrl.query) {
			newUrl.query = {};
		}
		__.each(options,function(value, key, list) {
			newUrl.query[key] = value;
		});
		if (hash) {
			newUrl.hash = hash;
		}
		return url.format(newUrl);
	};
	state = randomstring.generate(16);
	var authorizeUrl = buildUrl(authServer.authorizationEndpoint, {
		response_type: 'code',
		client_id: client.client_id,
		redirect_uri: client.redirect_uris[0],
		state: state
	});
	res.redirect(authorizeUrl);
});

app.get('/callback', function(req, res){
	var code = req.query.code;
	var form_data = qs.stringify({
		grant_type: 'authorization_code',
		code: code,
		redirect_uri: client.redirect_uris[0],
		state: state
	});
	var headers = {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Authorization': 'Basic ' + encodeClientCredentials(client.client_id, client.client_secret)
	}
	var tokRes = request('POST', authServer.tokenEndpoint, {
		body: form_data,
		headers: headers
	});
	var body = JSON.parse(tokRes.getBody('utf8'));
	log('Token response: ' + JSON.stringify(body));
	access_token = body.access_token;
	log('set access_token: ' + access_token);
	res.render('index',{access_token: body.access_token});
});

app.get('/fetch_resource', function(req, res) {
	if (!access_token){
		res.render('error',{error: 'Missing access token'});
		return;
	}
	var headers = {
		'Authorization': 'Bearer ' + access_token
	};
	var resource = request('POST', protectedResource, {
		headers: headers
	});
	log('Resource response: ' + resource.statusCode);
	if (resource.statusCode >= 200 && resource.statusCode < 300) {
		var body = JSON.parse(resource.getBody('utf8'));
		res.render('data',{resource: body});
		return;
	}else{
		log('Error fetching resource: ' + resource.statusCode);
		res.render('error',{error: 'Error fetching resource: ' + resource.statusCode});
		return;
	}
	
});

var buildUrl = function(base, options, hash) {
	var newUrl = url.parse(base, true);
	delete newUrl.search;
	if (!newUrl.query) {
		newUrl.query = {};
	}
	__.each(options, function(value, key, list) {
		newUrl.query[key] = value;
	});
	if (hash) {
		newUrl.hash = hash;
	}
	
	return url.format(newUrl);
};

var encodeClientCredentials = function(clientId, clientSecret) {
	return Buffer.from(querystring.escape(clientId) + ':' + querystring.escape(clientSecret)).toString('base64');
};

app.use('/', express.static('files/client'));

var server = app.listen(9000, 'localhost', function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log('OAuth Client is listening at http://%s:%s', host, port);
});
 
