import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {newRoom,addPlayer,movePlayer,publicState,terminalCommand,gameAction,intrusionInput,tick} from '../shared/core.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export function createApp(port=Number(process.env.PORT)||3000){
 const app=express();app.disable('x-powered-by');
 app.use('/assets',express.static(path.join(root,'assets')));
 app.use('/shared',express.static(path.join(root,'shared')));
 app.get('/health',(_,res)=>res.json({ok:true}));
 app.get('/',(_,res)=>res.sendFile(path.join(root,'index.html')));
 const http=createServer(app),io=new Server(http,{maxHttpBufferSize:2048,cors:{origin:true}});
 const rooms=new Map();const socketRoom=new Map();
 const code=()=>randomBytes(3).toString('hex').toUpperCase();
 const emitRoom=room=>{for(const id of Object.keys(room.players)){const s=io.sockets.sockets.get(id);if(s)s.emit('state',publicState(room,id));}};
 const error=(ack,e)=>ack?.({ok:false,error:e.message||String(e)});
 io.on('connection',socket=>{
   let lastMove=0;
   socket.on('enter',(data={},ack)=>{
     try{
       if(socketRoom.has(socket.id))throw Error('Already in a room.');
       const wanted=String(data.code||'').toUpperCase().trim(),requested=!!wanted;
       let room;if(requested){room=rooms.get(wanted);if(!room)throw Error('Room not found.');}
       else {if(rooms.size>=30)throw Error('Server full.');let c;do{c=code();}while(rooms.has(c));room=newRoom(c);rooms.set(c,room);}
       addPlayer(room,socket.id,data.name);socketRoom.set(socket.id,room.code);socket.join(room.code);
       ack?.({ok:true,code:room.code,id:socket.id});emitRoom(room);
     }catch(e){error(ack,e);}
   });
   socket.on('move',(p={})=>{const r=rooms.get(socketRoom.get(socket.id));if(!r||Date.now()-lastMove<40)return;lastMove=Date.now();movePlayer(r,socket.id,p);io.to(r.code).emit('peers',Object.values(r.players));});
   socket.on('command',(input,ack)=>{
     try{const r=rooms.get(socketRoom.get(socket.id));if(!r)throw Error('Join a room.');const output=terminalCommand(r,socket.id,input);
       ack?.({ok:true,...output});emitRoom(r);
     }catch(e){error(ack,e);}
   });
   socket.on('action',(data={},ack)=>{
     try{const r=rooms.get(socketRoom.get(socket.id));if(!r)throw Error('Join a room.');
       const result=gameAction(r,socket.id,data.type,data.payload);ack?.(result);emitRoom(r);
     }catch(e){error(ack,e);}
   });
   socket.on('defend',(key,ack)=>{
     try{const r=rooms.get(socketRoom.get(socket.id));if(!r)throw Error('Join a room.');
       const result=intrusionInput(r,socket.id,key);ack?.(result);emitRoom(r);
     }catch(e){error(ack,e);}
   });
   socket.on('disconnect',()=>{const r=rooms.get(socketRoom.get(socket.id));if(!r)return;delete r.players[socket.id];delete r.terminals[socket.id];delete r.intrusions[socket.id];socketRoom.delete(socket.id);if(!Object.keys(r.players).length)rooms.delete(r.code);else emitRoom(r);});
 });
 const interval=setInterval(()=>{for(const room of rooms.values())if(tick(room))emitRoom(room);},300);interval.unref();
 return {app,http,io,rooms,close:async()=>{clearInterval(interval);await new Promise(resolve=>io.close(resolve));await new Promise(resolve=>http.listening?http.close(()=>resolve()):resolve());}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const a=createApp();a.http.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Dead Drop listening'));}
