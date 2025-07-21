const WEBRTC_PING_MESSAGE = "9ca3b441-9558-4ba2-afbf-ebd518ecdc03";
const WEBRTC_PONG_MESSAGE = "9ca3b442-9558-4ba2-afbf-ebd518ecdc03";

class WebrtcSignalingServer{
  constructor(port){
    this.wsserver = cordova.plugins.wsserver;
    this.port = port;
    this.connList = [];
    this.callbacks = [];
  }

  async open(clientId, pinCode){
    await new Promise(resolve =>{
        this.wsserver.stop(() => setTimeout(resolve, 1000), () => setTimeout(resolve, 3000));
    });

    this.clientId = clientId;
    this.connList = [];
    this.pinCode = pinCode;

    await new Promise((resolve, reject) =>{
      this.wsserver.start(this.port, {
        onFailure :  (addr, port, reason) => {
            console.log('Stopped listening on %s:%d. Reason: %s', addr, port, reason);

            var callback = this.callbacks.find(item => item.type == "close" );
            if( callback )
              callback.callback(reason);
        },

        onOpen : (conn) => {
            console.log('A user connected from %s', conn.remoteAddr);
            /* conn: {
              'uuid' : '8e176b14-a1af-70a7-3e3d-8b341977a16e',
              'remoteAddr' : '192.168.1.10',
              'httpFields' : {...},
              'resource' : '/?param1=value1&param2=value2'
            } */

            this.wsserver.send(conn, JSON.stringify({
              type: "ready",
              clientId: this.clientId,
            }));
        },

        onMessage : (conn, msg) =>{
          console.log(conn, msg); // msg can be a String (text message) or ArrayBuffer (binary message)

          if( msg == WEBRTC_PING_MESSAGE ){
            this.wsserver.send(conn, WEBRTC_PONG_MESSAGE);
            return;
          }else if( msg == WEBRTC_PONG_MESSAGE ){
            return;
          }

          var body = JSON.parse(msg);
          console.log("websocket message", body);

          if( body.type == "ready" ){
            if( this.pinCode != body.pinCode ){
              console.error("invalid pinCode");
              return;
            }

            var index = this.connList.findIndex(item => item.remoteClientId == body.clientId );
            if( index >= 0 ){
              this.wsserver.close(this.connList[index].conn, 4000);
              this.connList.splice(index, 1);
            }
            this.connList.push({
              conn: conn,
              remoteClientId: body.clientId
            });
            var callback = this.callbacks.find(item => item.type == body.type );
            if( callback )
              callback.callback(body.clientId);
          }else {
            if( body.type == "sdpOffer1" || body.type == "sdpAnswer" || body.type == "iceCandidate" ){
              var callback = this.callbacks.find(item => item.type == body.type );
              if( callback )
                callback.callback(body.clientId, body.data);
            }
          }
        },
        
        onClose : (conn, code, reason, wasClean) =>{
            console.log('A user disconnected from %s', conn.remoteAddr);
            var index = this.connList.findIndex(item => item.conn.uuid == conn.uuid );
            if( index >= 0 ){
              var remoteClientId = this.connList[index].remoteClientId; 
              this.wsserver.close(this.connList[index].conn, 4000);
              this.connList.splice(index, 1);
              var callback = this.callbacks.find(item => item.type == "disconnect" );
              if( callback )
                callback.callback(remoteClientId, code, reason);
            }
        },
      }, (addr, port) => {
        console.log('Listening on %s:%d', addr, port);
        resolve();
      }, (reason) => {
        console.log('Did not start. Reason: %s', reason);
        reject(reason);
      });
    });

    var callback = this.callbacks.find(item => item.type == "open" );
    if( callback )
      callback.callback();
  }

  close(){
    this.wsserver.stop();
  }

  // type=open, close, ready, disconnect, sdpOffer1, sdpAnswer, iceCandidate
  on(type, callback){
    var item = this.callbacks.find(item => item.type == type);
    if(!item){
      this.callbacks.push({ type: type, callback: callback });
    }else{
      item.callback = callback;
    }
  }

  sendSdpOffer2(remoteClientId, offer){
    var item = this.connList.find(item => item.remoteClientId == remoteClientId );
    if( !item )
      return;
    this.wsserver.send(item.conn, JSON.stringify({
      type: "sdpOffer2",
      clientId: this.clientId,
      target: remoteClientId,
      data: offer
    }));
  }

  sendIceCandidate(remoteClientId, candidate){
    var item = this.connList.find(item => item.remoteClientId == remoteClientId );
    if( !item )
      return;
    this.wsserver.send(item.conn, JSON.stringify({
      type: "iceCandidate",
      clientId: this.clientId,
      target: remoteClientId,
      data: candidate
    }));
  }

  sendSdpAnswer(remoteClientId, answer){
    var item = this.connList.find(item => item.remoteClientId == remoteClientId );
    if( !item )
      return;
    this.wsserver.send(item.conn, JSON.stringify({
      type: "sdpAnswer",
      clientId: this.clientId,
      target: remoteClientId,
      data: answer,
    }));
  }  
}
