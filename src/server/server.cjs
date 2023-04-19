const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const port = 6969;
const server = http.createServer(express);
const wss = new WebSocket.Server({ server })


var SFS2X = require('../server/SFS2X.cjs')
console.log('123')
let _smartFox
let netbet

const CLIENTS = {};
var connectionIDCounter = 0;

wss.on('connection', function connection(ws) {
    ws.id = connectionIDCounter;
    CLIENTS[ws.id] = ws;
    console.log(CLIENTS);
    
    // netbet = ws;
    if (ws.id == 1) {
        ws.onmessage = function (evt) {
            console.log(evt);
            data = JSON.parse(evt.data);
            if(evt.data.c = "connectSf" ) {
                _smartFox.connect();
                ws.send("smartfox connect");
            }
            // console.log("method", data)
            // CLIENTS['1'].send(data);
        }
        // ws.onmessage = function (data) {
        //     console.log(data);
        //     data = JSON.stringify({ "c": "connectSf", "h": "sfs-fat.ttt.link", "p": 7443 });
        //     console.log("method", data)
        //     CLIENTS['1'].send(data);
        // }
    }
    // netbet.onopen =() =>{
    //     console.log("method")
    //     netbet.send(JSON.stringify({ "c": "connectSf", "h": "sfs-fat.ttt.link", "p": 7443 }))
    // }
    // netbet.on('message', function message(msg){
    //     console.log('message123',msg)
    //     // switch (msg){
    //     //     case 'c':

    //             sendMessage();
    //         // break;
    //     // }
    // })

    const host = "sfs-fat.ttt.link";
    const port = 7443;
    var connecntConfig = {};
    connecntConfig.host = host;
    connecntConfig.port = port;
    connecntConfig.zone = "GameServer";
    connecntConfig.debug = false;

    _smartFox = new SFS2X.SmartFox(connecntConfig);

    _smartFox.addEventListener(SFS2X.SFSEvent.CONNECTION, function (evt) {
        console.log('starLog smartfox connect', evt);
    });
    // _smartFox.connect();
    ws.id = connectionIDCounter++;
})

// function sendMessage() {
//     console.log("method")
//     netbet.send(JSON.stringify({ "c": "connectSf", "h": "sfs-fat.ttt.link", "p": 7443 }))
// }

server.listen(port, function () {
    console.log(`Server is listening on ${port}!`)
})



