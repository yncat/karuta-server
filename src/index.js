var WebSocketServer = require('websocket').server;
var http = require('http');
var soundList=require('./soundList.js');

const PORT = process.env.PORT || 3000;

var connections=new Array();

var remote_controller=null;

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(PORT, function() {
    console.log((new Date()) + ' Server is listening on port '+PORT);
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  console.log("origin:"+origin);
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

function sendMessage(message_plain){
  if(connections.length==0) return;
  message_json=JSON.stringify(message_plain);
  connections.forEach((elem) => {elem.sendUTF(message_json);});
}

function sendMessageTo(message_plain,connection){
  message_json=JSON.stringify(message_plain);
  connection.sendUTF(message_json);
}


function notifyConnectionCount(){
var msg={'command': 'player_count', 'number': connections.length};
sendMessage(msg);
}

function processRemoteControlRequest(sender_connection){
  if(remote_controller){
    sendMessageTo({'command': 'remote_control_request_result', 'result': 'false'},sender_connection);
  }else{
    remote_controller=sender_connection;
    sendMessageTo({'command': 'remote_control_request_result', 'result': 'true'},sender_connection);
  }
}

function sendChallenge(cards,play_list){
  var send={'command': 'play', 'filename': null};
  for(var i=0;i<cards.length;i++){
    send['filename']=play_list[i];
    const send_json=JSON.stringify(send);
    cards[i].sendUTF(send_json);
  }
}

function processChallengeRequest(m){
  const right_sound=m['filename'];
  var cards=connections.filter((elem)=>{return elem !== remote_controller;});
  if(cards.length==0){
    return;
  }
  if(cards.length==1){
    sendChallenge(cards,[right_sound]);
   return;
  }
  var sound_candidates=soundList.sounds.slice(0,soundList.sounds.length);
  sound_candidates=sound_candidates.filter((elem)=>{return elem != right_sound;});
  const sound_candidates_backup=sound_candidates.slice(0,sound_candidates.length);
  var play_list=new Array(cards.length);
  play_list[Math.floor(Math.random()*cards.length)]=right_sound;
  for(var i=0;i<cards.length;i++){
    if(play_list[i]){
      continue;
    }
    if(sound_candidates.length>0){
      const r=Math.floor(Math.random()*sound_candidates.length);
      play_list[i]=sound_candidates[r];
      sound_candidates.splice(r,1);
    }else{
      play_list[i]=sound_candidates_backup[Math.floor(Math.random()*sound_candidates_backup.length)];
    }
  }
  sendChallenge(cards,play_list);
}

function processMessage(message,sender_connection){
  const m=JSON.parse(message);
  if(m['command']=='request'){
    processChallengeRequest(m);
  }
  if(m['command']=='remote_control_request'){
    processRemoteControlRequest(sender_connection);
    return;
  }
  if(m['command']=='remote_control_exit'){
    remote_controller=null;
  }
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }

    var connection = request.accept('karuta-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connections.push(connection);
    notifyConnectionCount();
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            processMessage(message.utf8Data,connection);
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        connections = connections.filter(function( item ) {return item !== connection;});
        if(remote_controller===connection) remote_controller=null;
        notifyConnectionCount();
    });
});
