var express = require('express');
var fs		= require('fs');
var path 	= require('path');
var app 	= express();
var http	= require('http').Server(app);
var io		= require('socket.io')(http);
var port	= process.env.PORT || 3000;
var words	= [];

process.setMaxListeners(0);

app.use("/", express.static(__dirname));

var time = 60;

fs.readFile('etc/words.txt', "utf-8", function (err, data) {
  if (err) throw err;
	words = data.split('\n');
});

var knex = require('knex')({
  client: 'pg',
  connection: process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL,
  searchPath: 'knex,public,doodlera_schema'
});

knex.schema.withSchema('doodlera_schema').createTableIfNotExists('doodlera_table', function (table) {
  table.increments();
  table.string('name');
  table.integer('points').defaultTo(0);
}).then();

var bookshelf = require('bookshelf')(knex);

var User = bookshelf.Model.extend({
  tableName: 'doodlera_table'
});

setInterval( function() {
	if (playercount != 0) {
				
		if (time == 60)
			currentword = words[Math.floor(Math.random() * 499)];
		
		io.emit('updateTimer', time, currentword);
		
		time = time - 1;
		if (time == 0)
			time = 75;
	}
}, 1000);

var playercount = 0;

io.sockets.on('connection', function(socket){
	
	const results = [];

	var socketid;
	var name;
	var exists = false;
	
	socket.on('chosenname', function(name){
		socketid = 0;
		
		new User({'name': name})
		.fetch()
		.then(function(model) {
			if (model == null) {
				new User({'name': name}).save().then(function(mdl) {
					socketid = mdl.get('id');
				});
			}
			else {
				socketid = model.get('id');
			}
			playercount = playercount + 1;
		});
    });
	
	socket.on('chat message', function(name, msg) {
		if (msg == "!points")
		{
			new User({'name': name})
			.fetch()
			.then(function(model) {
				io.emit('chat message',null,'' + name + ' has ' + model.get('points') + ' points.');
			});
		}
		io.emit('chat message', name, msg);
	});
	
	socket.on('queuedrawing', function(image, name){
		io.emit('queuedrawing', image, name);
	});
	
	socket.on('winner', function(voter,winner){
		
		io.emit('chat message', null, '' + voter + " voted for " + winner + "!");
		
		knex('doodlera_table').where('name',winner).increment('points').then();
	});
	
	socket.on('disconnect', function() {

		new User({'id': socketid})
		.fetch()
		.then(function(model) {
			io.emit('chat message',null,'' + model.get('name').replace(/`/g , "") + ' disconnected.');
			playercount = playercount - 1;
		});
	});
});


http.listen(port, function(){
  console.log('listening on *:' + port);
});
