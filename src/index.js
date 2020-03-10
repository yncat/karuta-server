var WebSocketServer = require('websocket').server;
var http = require('http');

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

function sendMessage(message_plain,exclude_remote_controller=false){
  if(connections.length==0) return;
  message_json=JSON.stringify(message_plain);
  connections.forEach((elem) => {
    if(!exclude_remote_controller){
      elem.sendUTF(message_json);
    }else if(elem!==remote_controller){
      elem.sendUTF(message_json);
    }
  });
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
    sendMessageTo({'remote_control_request_result': 'false'},sender_connection);
  }else{
    remote_controller=sender_connection;
    sendMessageTo({'remote_control_request_result': 'true'},sender_connection);
  }
}

function processMessage(message,sender_connection){
  const m=JSON.parse(message);
  if(m['command']=='request'){
    var message={'command': 'play', 'filename': m['filename']};
    sendMessage(message);
  }
  if(m['command']=='remote_control_request'){
    ProcessRemoteControlRequest(sender_connection);
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
            processMessage(message.utf8Data);
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
        connections = connections.filter(function( item ) {return item !== connection;});
        notifyConnectionCount();
    });
});
