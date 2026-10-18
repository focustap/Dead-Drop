import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {newRoom,addPlayer,movePlayer,publicState,terminalCommand,gameAction,intrusionInput,tick} from '../shared/core.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export function createApp(){
  const app=express();app.disable('x-powered-by');
  app.get('/health',(_req,res)=>res.json({ok:true}));
  app.use(express.static(path.join(root,'dist')));
  const http=createServer(app),io=new Server(http,{maxHttpBufferSize:4096});
  const rooms=new Map(),joined=new Map();
  const emitState=room=>{for(const player of Object.values(room.players)){
    const s=io.sockets.sockets.get(player.id);
    if(s)s.emit('state',publicState(room,player.id));
  }};
  const roomFor=socket=>{const room=rooms.get(joined.get(socket.id));if(!room)throw Error('Join a room first.');return room;};
  const ackError=(ack,error)=>ack?.({ok:false,text:String(error.message||'Unavailable').slice(0,160)});
  io.on('connection',socket=>{
    socket.on('room:create',(data={},ack)=>{
      try{
        if(joined.has(socket.id))throw Error('Already connected to a room.');
        if(rooms.size>=40)throw Error('Server full.');
        let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
        const room=newRoom(code);addPlayer(room,socket.id,data.name);rooms.set(code,room);joined.set(socket.id,code);socket.join(code);
        ack?.({ok:true,code,playerId:socket.id,state:publicState(room,socket.id)});emitState(room);
      }catch(error){ackError(ack,error);}
    });
    socket.on('room:join',(data={},ack)=>{
      try{
        if(joined.has(socket.id))throw Error('Already connected to a room.');
        const code=String(data.code||'').toUpperCase().trim();
        const room=rooms.get(code);if(!room)throw Error('Room not found.');
        addPlayer(room,socket.id,data.name);joined.set(socket.id,code);socket.join(code);
        ack?.({ok:true,code,playerId:socket.id,state:publicState(room,socket.id)});emitState(room);
      }catch(error){ackError(ack,error);}
    });
    let lastMove=0;
    socket.on('player:move',position=>{
      const room=rooms.get(joined.get(socket.id));
      if(!room||Date.now()-lastMove<55)return;
      lastMove=Date.now();movePlayer(room,socket.id,position);socket.to(room.code).emit('peers',Object.values(room.players));
    });
    socket.on('game:action',({event,payload}={},ack)=>{
      try{
        const room=roomFor(socket);let output;
        if(event==='terminal')output={ok:true,...terminalCommand(room,socket.id,payload?.line)};
        else if(event==='intrusion')output=intrusionInput(room,socket.id,payload?.key);
        else output=gameAction(room,socket.id,event,payload);
        ack?.(output);emitState(room);
      }catch(error){ackError(ack,error);}
    });
    socket.on('disconnect',()=>{
      const code=joined.get(socket.id);if(!code)return;
      const room=rooms.get(code);joined.delete(socket.id);if(!room)return;
      delete room.players[socket.id];delete room.terminals[socket.id];delete room.intrusions[socket.id];
      if(!Object.keys(room.players).length)rooms.delete(code);
      else emitState(room);
    });
  });
  const interval=setInterval(()=>{
    for(const room of rooms.values())if(tick(room))emitState(room);
  },250);
  interval.unref();
  return {app,http,io,rooms,async close(){
    clearInterval(interval);
    await new Promise(resolve=>io.close(resolve));
    if(http.listening)await new Promise(resolve=>http.close(resolve));
  }};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const game=createApp();game.http.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Dead Drop online'));
}
