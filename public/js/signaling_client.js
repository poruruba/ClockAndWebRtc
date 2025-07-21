const WEBRTC_PING_MESSAGE = "9ca3b441-9558-4ba2-afbf-ebd518ecdc03";
const WEBRTC_PONG_MESSAGE = "9ca3b442-9558-4ba2-afbf-ebd518ecdc03";

class WebrtcSignalingClient{
  constructor(){
    this.callbacks = [];
    this.connected = false;
  }

  async open(url, clientId, pinCode){
    this.clientId = clientId;
    this.pinCode = pinCode;
    
    this.ws_socket = new WebSocket(url);

    await new Promise((resolve, reject) =>{
      let connected = false;

      this.ws_socket.onopen = (event) => {
  //      console.log("websocket opened", event);
        connected = true;
        resolve();
      };

      this.ws_socket.onerror = (event) =>{
  //      console.error("websocket error", event);
        if( !connected )
          return reject(event);

        var callback = this.callbacks.find(item => item.type == "error" );
        if( callback )
          callback.callback(event);
      };

      this.ws_socket.onclose = (event) =>{
        //      console.log("websocket closed", event);
        if( !connected )
          return reject(event);

        var callback = this.callbacks.find(item => item.type == "close" );
        if( callback )
          callback.callback();
      };
      
      this.ws_socket.onmessage = (event) => {
        if( event.data == WEBRTC_PING_MESSAGE ){
          this.ws_socket.send(WEBRTC_PONG_MESSAGE);
          return;
        }else if( event.data == WEBRTC_PONG_MESSAGE ){
          return;
        }

        var body = JSON.parse(event.data);
  //      console.log("websocket message", body);

        if( body.type == "ready" ){
          var callback = this.callbacks.find(item => item.type == body.type );
          if( callback )
            callback.callback(body.clientId);
        }else
        if( body.type == "sdpOffer2" || body.type == "sdpAnswer" || body.type == "iceCandidate" ){
          var callback = this.callbacks.find(item => item.type == body.type );
          if( callback )
            callback.callback(body.clientId, body.data);
        }else
        if( body.type == 'error' ){
          var callback = this.callbacks.find(item => item.type == "error" );
          if( callback )
            callback.callback(body.message);
        }
      };
    });

    this.ws_socket.send(JSON.stringify({
      type: "ready",
      clientId: this.clientId,
      pinCode: this.pinCode
    }));

    var callback = this.callbacks.find(item => item.type == "open" );
    if( callback )
      callback.callback();
  }

  close(){
    this.ws_socket.close();
  }

  // type=open, sdpOffer1, sdpAnswer, iceCandidate, close
  on(type, callback){
    var item = this.callbacks.find(item => item.type == type);
    if(!item){
      this.callbacks.push({ type: type, callback: callback });
    }else{
      item.callback = callback;
    }
  }

  sendSdpOffer1(remoteClientId, offer){
    this.ws_socket.send(JSON.stringify({
      type: "sdpOffer1",
      clientId: this.clientId,
      target: remoteClientId,
      data: offer
    }));
  }

  sendIceCandidate(remoteClientId, candidate){
    this.ws_socket.send(JSON.stringify({
      type: "iceCandidate",
      clientId: this.clientId,
      target: remoteClientId,
      data: candidate
    }));
  }

  sendSdpAnswer(remoteClientId, answer){
    this.ws_socket.send(JSON.stringify({
      type: "sdpAnswer",
      clientId: this.clientId,
      target: remoteClientId,
      data: answer,
    }));
  }  
}
