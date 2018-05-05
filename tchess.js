//TODO
//AI
var AWS = require('aws-sdk');
AWS.config.update({region:'us-east-1'});
var documentClient = new AWS.DynamoDB.DocumentClient();
var webshot = require('webshot');
var chess = require("chess.js").Chess();
var twitterCreds = require("./chessbot9000TwitterCreds.json");
var Twitter = require("twitter");
var client = new Twitter(twitterCreds);
var express = require("express");
var colors = require("colors");
var app = express();
var lastProcessedTweet;
var fs = require("fs");
var webshotOptions = {
  defaultWhiteBackground: true,
  shotSize: {
    width: 410,
    height: 410
  },
  phantomConfig: {
    "ignore-ssl-errors": "true",
    "ssl-protocol": "any"
  },
  renderDelay: 1000,
  siteType:'url',
  userAgent: "foo"
};


function getLastProcessedTweet(){
  var dbParams = {
    TableName: "Chess",
    Key:{
        "id_str_pair": "lastProcessedTweet"
    }
  };
  documentClient.get(dbParams, function(err, data) {
    if (err) {
        console.log("error getting last processed Tweet".red);
    } 
    else {
      if(!data.Item){
        console.log("lastProcessedTweet not found in db".yellow);
        lastProcessedTweet = null;
      }
      else{
        lastProcessedTweet = data.Item.tweet_id_str;
      }
    }
  });
}
function updateLastProcessedTweet(){
  var item = {
    id_str_pair: "lastProcessedTweet",
    tweet_id_str: lastProcessedTweet
  }
  var dbParams = {
    TableName: "Chess",
    Item: item
  }
  documentClient.put(dbParams, function(err, data) {
      if (err) {
        console.log(err);
        console.log("error putting last processed tweet in db".red);
      }
      else{
        //console.log("put last processed tweet in db".green);
      }
  });
}
function getMentions(){
  console.log("...");
  var options = {since_id: lastProcessedTweet, count: 200};

  client.get('statuses/mentions_timeline', options, function(error, tweets, response) {
    if(error){
      console.log("error getting mentions timeline".red);
      return;
    }
    for(i = tweets.length - 1;i > -1;i--){
      parseMention(tweets[i]);
    }
    if(tweets.length > 0){
      lastProcessedTweet = tweets[0].id_str;
      updateLastProcessedTweet();
    }
  });
}
function parseMention(tweet){
  var game = {
    board: "placeholder",
    state: "",
    w: "",
    b: ""
  }
  var tweet_id_str = tweet.id_str;
  var command = "";
  var target_screen_name = "";
  var target_id_str = "";
  var target_name = "";
  var user_screen_name = tweet.user.screen_name;
  var user_name = tweet.user.name;
  var user_id_str = tweet.user.id_str;
  var user_mentions = tweet.entities.user_mentions;
  if (user_mentions.length >= 2){
    if (user_mentions[0].screen_name === "ChessBot9000"){
      target_screen_name = user_mentions[1].screen_name;
      target_id_str = user_mentions[1].id_str;
      target_name = user_mentions[1].name;
    }
    else{
      target_screen_name = user_mentions[0].screen_name;
      target_id_str = user_mentions[0].id_str;
      target_name = user_mentions[0].name;
    }
  }
  else{
    console.log("too few entities".red); 
    return;
  }
  var text = tweet.text;
  console.log(text);
  for(var i = user_mentions.length - 1;i > -1;i--){
    text = text.slice(0, user_mentions[i].indices[0]) + text.slice(user_mentions[i].indices[1]);
  }
  text = text.trim();
  text = text.toLowerCase();
  console.log(`text after transformations ${text}`);
  var re = /\b[A-Za-z0-9_-]+\b/g;
  var matches = text.match(re);
  if(matches) command = matches[0];
  else{
    console.log("unable to parse command".red);
    return;
  }
  var id_str_pair;
  if(user_id_str < target_id_str){
    id_str_pair = user_id_str + "-" + target_id_str;
  }
  else{
    id_str_pair = target_id_str + "-" + user_id_str;
  }
  var req = {
    tweet_id_str: tweet.id_str,
    action: "",
    game: game,
    user_screen_name: user_screen_name,
    user_id_str: user_id_str,
    user_name: user_name,
    target_screen_name: target_screen_name,
    target_id_str: target_id_str,
    target_name: target_name,
    id_str_pair: id_str_pair
  }
  if(command === "invite"){
    console.log("invite");
    req.action = "invite";
    req.game.state = "waitingAccept";
    req.game.w = user_id_str;
    req.game.b = target_id_str;

    getGame(req);
  }
  else if(command === "accept"){
    console.log("accept");
    req.action = "accept";
    req.game.state = "inProgress";

    getGame(req);
  }
  /*
  else if(command === "blockuser"){
    console.log("blockuser");
    req.action = "blockuser";

    getBlocked(req);
  }
  else if(command === "blockbot"){
    console.log("blockbot");
    req.action = "blockbot";

    getBlocked(req);
  }
  */
  else if(command === "decline"){
    console.log("decline");
    req.action = "decline";

    getGame(req);
  }
  else if(command === "forfeit"){
    console.log("forfeit");
    req.action = "forfeit";

    getGame(req);
  }
  else if(command === "proposedraw"){
    console.log("proposedraw");
    req.action = "proposedraw";

    getGame(req);
  }
  else if(command === "acceptdraw"){
    console.log("acceptdraw");
    req.action = "acceptdraw";

    getGame(req);
  }
  else if(command === "declinedraw"){
    console.log("declinedraw");
    req.action = "declinedraw";

    getGame(req);
  }
  /*
  else if(command === ""){
    console.log("");
    req.action = "";
  }
  */
  else {
    console.log("move");
    req.action = "move";
    req.move = command;
    req.game.state = "inProgress";

    getGame(req);
  }
}
/*
function getBlocked(req){
  var id_str_pair;
  if(req.action === "invite"){
    id_str_pair = req.target_id_str; 
  }
  else if(req.action === "blockuser"){
    id_str_pair = req.user_id_str;
  }
  else if(req.action === "blockbot"){
    id_str_pair = req.user_id_str;
  }

  var dbParams = {
    TableName: "Chess",
    Key:{
        "id_str_pair": id_str_pair
    }
  };
  documentClient.get(dbParams, function(err, data) {
    if (err) {
        console.log("error getting blocked".red);
    } 
    else {
      if(req.action === "invite"){
        if(!data.Item) getGame(req);
        else if(data.Item.blockBot){
          console.log("target has blocked bot".red);
        }
        else if(data.Item.hasOwnProperty("id_strArr")){
          var id_strArr = data.Item.id_strArr;
          for(var i = 0;i < id_strArr.length;i++){
            if(id_strArr[i] === req.user_id_str){
              console.log("target has blocked user".red);
              return;
            }
          }
        }
        else{
          console.log("target has not blocked bot or user".green);
          getGame(req);
        }
      }
      else if(req.action === "blockuser"){
        if(!data.Item){
          var block = {
            id_str_pair: req.user_id_str,
            id_strArr: [req.target_id_str]
          }
          req.block = block;
        }
        else{
          req.block = data.Item;
          req.block.id_strArr.push(req.target_id_str);
        }
        updateBlock(req);
      }
      else if(req.action === "blockbot"){
        if(!data.Item){
          var block = {
            id_str_pair: req.user_id_str,
            blockBot: true
          }
          req.block = block;
        }
        else{
          req.block = data.Item;
          req.block.blockBot = true;
        }
        updateBlock(req);
      }
    }
  }); 
}
function updateBlock(req){
  var dbParams = {
    TableName: "Chess",
    Item: req.block
  }
  documentClient.put(dbParams, function(err, data) {
      if (err) {
        console.log(err);
        console.log("error putting block into DB".red);
        //TODO 
        //notify user
      }
      else{
        console.log("successfully put block into DB".green);
      }
  });
}
*/
function getGame(req){
  var dbParams = {
    TableName: "Chess",
    Key:{
        "id_str_pair": req.id_str_pair 
    }
  };
  console.log(dbParams);
  documentClient.get(dbParams, function(err, data) {
    if (err) {
        console.log("error getting game".red);
    } 
    else {
      if(!data.hasOwnProperty("Item") && req.action === "invite"){
        updateGame(req);
        return;
      }
      else if(!data.hasOwnProperty("Item")){
        console.log("game not found".red);
        return;
      }

      if(req.action === "invite"){
        //send another invite?
      }
      else if(req.action === "accept"){
        if(data.Item.state === "waitingAccept"){
          req.game = data.Item;
          req.game.state = "inProgress";
          doMove(req);
        }
      }
      else if(req.action === "move"){
        if(data.Item.state !== "waitingAccept"){
          req.game = data.Item;

          doMove(req);
        }
      }
      else if(req.action === "decline"){
        if(data.Item.state === "waitingAccept"){
          deleteGame(req);
        }
      }
      else if(req.action === "forfeit"){
        if(data.Item.state !== "waitingAccept"){
          req.game = data.Item;
          deleteGame(req);
        }
      }
      else if(req.action === "proposedraw"){
        if(data.Item.state !== "waitingAccept"){
          req.game = data.Item;
          if(req.game.hasOwnProperty("pDraw")){
            console.log("draw already proposed".red);
            return;
          }
          req.game.pDraw = req.user_id_str;
          updateGame(req);
        }
      }
      else if(req.action === "acceptdraw"){
        if(data.Item.state !== "waitingAccept"){
          req.game = data.Item;
          if(!req.game.hasOwnProperty("pDraw")){
            console.log("draw has not yet been proposed".red);
            return;
          }
          else if(req.game.pDraw !== req.user_id_str){
            deleteGame(req);
          }
        }
      }
      else if(req.action === "declinedraw"){
        if(data.Item.state !== "waitingAccept"){
          req.game = data.Item;
          if(!req.game.hasOwnProperty("pDraw")){
            console.log("draw has not yet been proposed".red);
            return;
          }
          else if(req.game.pDraw !== req.user_id_str){
            delete req.game.pDraw;
            updateGame(req);
          }
        }
      }
    }
  }); 
}
function doMove(req){
  delete req.game.pDraw;
  var gameOver;
  if(req.action === "accept"){
    board = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    req.game.board = board;
  }
  else if(req.action === "move"){
    var goodBoard = chess.load(req.game.board);
    if(!goodBoard){
      console.log("fen not valid".red);
      return
    }
    console.log(chess.ascii());
    var userColor;
    var targetColor;
    if(req.user_id_str === req.game.w){
      userColor = "w";
      targetColor = "b";
    }
    else if(req.user_id_str === req.game.b){
      userColor = "b";
      targetColor = "w";
    }
    req.userColor = userColor;
    req.targetColor = targetColor;
    if(chess.turn() !== userColor){
      //TODO Tweet at user
      console.log("out of turn move".red);
      req.userError = "invalid move: out of turn move";
      sendTweet(req);
      return;
    }
    if(chess.move(req.move, {sloppy: true})){
      console.log(chess.ascii());
      req.game.board = chess.fen();
      
      req.game.state = "inProgress";
      if(chess.in_checkmate()) req.game.state = "checkmate";
      else if(chess.in_stalemate()) req.game.state = "stalemate";
      else if(chess.in_draw()) req.game.state = "draw";
      else if(chess.in_check()) req.game.state = "check";
      else if(chess.in_threefold_repetition()) req.game.state = "threefold repetition";

      req.game.gameOver = chess.game_over();
    }
    else{
      //TODO Tweet at user
      console.log("invalid move".red);
      req.userError = "invalid move";
      sendTweet(req);
      return;
    }
  }
  var picture = __dirname + "/board_pics/" + req.id_str_pair + ".png";
  console.log(`${picture}`.yellow);
  var url = "http://127.0.0.1:3000/board.html";
  var encodedBoard = encodeURIComponent(req.game.board);

  url += `?fen=${encodedBoard}&player=${targetColor}`;
  req.url = url;
  req.picture = picture;
  webshot(url, picture, webshotOptions, function(err) {
    if(err !== null) console.log("error taking webshot".red);
    else{
      if(req.game.gameOver) deleteGame(req);
      else updateGame(req);
    }
  });
}

function updateGame(req){
  console.log(req);
  req.game.id_str_pair = req.id_str_pair;
  var dbParams = {
    TableName: "Chess",
    Item: req.game
  }
  documentClient.put(dbParams, function(err, data) {
      if (err) {
        console.log(err);
        console.log("error putting updated Game into DB".red);
        //TODO 
        //notify user
      }
      else{
        console.log("success");
        if (req.action === "invite") sendTweet(req); 
        if (req.action === "accept") sendBoard(req); 
        if (req.action === "move") sendBoard(req); 
        if (req.action === "proposedraw") sendTweet(req); 
        if (req.action === "declinedraw") sendTweet(req); 
      }
  });
}
function deleteGame(req){
  var dbParams = {
    TableName: "Chess",
    Key: {
      id_str_pair: req.id_str_pair
    }
  }
  documentClient.delete(dbParams, function(err, data) {
      if (err) {
        console.log(err);
        console.log("error deleting game from DB".red);
        //TODO 
        //notify user
      }
      else{
        console.log("success");
        if (req.action === "decline"){
          //notify user?  
        }
        else if(req.action === "move"){
          sendBoard(req); 
        }
        else if(req.action === "forfeit"){
          sendTweet(req); 
        }
        else if(req.action === "acceptdraw"){
          sendTweet(req); 
        }
      }
  });
}

function sendTweet(req){
  var text;
  if(req.userError) text = `@${req.user_screen_name} ${req.userError}`;
  else{
    text = `@${req.user_screen_name} @${req.target_screen_name} ${req.user_name}`;
    if(req.action === "invite") text += ` has invited you to a game of chess.  Reply with "accept" to start a game.`;
    else if(req.action === "forfeit") text += ` has forfeited the game.`;
    else if(req.action === "proposedraw") text += ` has proposed a draw.  Reply with "acceptdraw" to accept.  Reply with "declinedraw" to decline.`;
    else if(req.action === "acceptdraw") text += ` has accepted your draw proposal.`;
    else if(req.action === "declinedraw") text += ` has declined your draw proposal.`;
  }
  text += ` ${randomString()}`;
  var status = {
    status: text
  }
  client.post('statuses/update', status, function(error, tweet, response) {
    if (error) {
      console.log("error sending tweet".red);
    }
    else{
      console.log("tweet sent".green);
    }
  });
}
function sendBoard(req){
  var data = fs.readFile(req.picture, function(err, data){
    if(err) {
      console.log("error reading file".red);
      return;
    }

    console.log("req.tweet_id_str = " + req.tweet_id_str);
    client.post('media/upload', {media: data}, function(error, media, response) {
      fs.unlink(req.picture, (err) => {});
      if(error) console.log("error uploading media".red);
      else {
        var text;
        if(req.game.state !== "inProgress"){
          text = `@${req.user_screen_name} @${req.target_screen_name} ${req.game.state}`;
        }
        else text = `@${req.user_screen_name} @${req.target_screen_name} ${req.target_name}'s turn`;
        var status = {
          status: text,
          media_ids: media.media_id_string 
        }
        client.post('statuses/update', status, function(error, tweet, response) {
          if (error) {
            console.log("error sending updated board".red);
          }
          else{
            console.log("updated board sent".green);
          }
        });
      }
    });
  });
}
//getRateLimit();
//getMostRecentMention();
getLastProcessedTweet();
//getMentions();
//getid_str(screen_names, updateGame, game);
//getid_str(screen_names, getGame, game);
//setInterval(getRateLimit, 10000);
setInterval(getMentions, 15000);
app.use(express.static(__dirname + "/public"));
app.get("/fen", function(req, res) {
  res.contentType("application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(game.board);
});
app.get("/board.html", function(req, res) {
  res.sendFile(__dirname + "/board.html");
});

var server = app.listen(3000, function () {
    console.log("Server running at http://127.0.0.1:3000/");
});
function sendServerError(req){
  var text = `@${req.user_screen_name} Uh-oh, something is wrong with the server!  Please try again later.`;
  var status = {
    status: text
  }
  client.post('statuses/update', status, function(error, tweet, response) {
    if (error) {
      console.log("error sending userError".red);
    }
    else{
      console.log("userError sent".green);
    }
  });
}
function getRateLimit(){
  client.get('application/rate_limit_status', {resources: "statuses"}, function(error, tweets, response) {
    if(error) console.log("error getting RateLimit".red);
    else console.log(JSON.stringify(tweets, null, 2));
  });
}
function getMostRecentMention(){
  client.get('statuses/mentions_timeline', {since_id: undefined}, function(error, tweets, response) {
    if(error) console.log("error getting most recent mention".red);
    if (tweets.length !== 0){
      lastProcessedTweet = tweets[0].id_str;
      updateLastProcessedTweet();
      //mostRecentMention = tweets[0].id_str;
    }
  });
}
//https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
function randomString() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 10; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
