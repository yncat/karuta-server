var WebSocketServer = require('websocket').server;
var http = require('http');

const PORT = process.env.PORT || 3000;

var connections=new Array();

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(PORT, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
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

function processMessage(message){
  const m=JSON.parse(message);
  if(m['command']=='request'){
    var message={'command': 'play', 'filename': m['filename']};
    sendMessage(message);
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
        console.log("number of connections: "+connections.length);
    });
});
