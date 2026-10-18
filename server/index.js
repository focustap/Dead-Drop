import express from 'express';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Server} from 'socket.io';
import {newRoom,addPlayer,movePlayer,publicState,terminalCommand,gameAction,intrusionInput,tick} from '../shared/core.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const app=express();app.disable('x-powered-by');app.use(express.static(root,{dotfiles:'deny'}));
app.get('/health',(_req,res)=>res.json({ok:true,game:'DEAD DROP',rooms:rooms.size}));
const http=createServer(app);
const io=new Server(http,{cors:{origin:process.env.ALLOWED_ORIGINS?.split(',').map(s=>s.trim()).filter(Boolean)||true,methods:['GET','POST']},
  maxHttpBufferSize:4096,pingTimeout:25000});
const rooms=new Map();
const code=()=>randomBytes(4).toString('hex').slice(0,6).toUpperCase();
function sendState(room){
  for(const p of io.sockets.sockets.values())if(p.data.roomCode===room.code&&room.players[p.data.playerId])p.emit('state',publicState(room,p.data.playerId));
}
const validName=n=>String(n||'Runner').slice(0,22).replace(/[\r\n<>]/g,'');
function join(socket,room,name){
  if(socket.data.roomCode)throw Error('Already in a room');
  const id=randomBytes(8).toString('hex');
  addPlayer(room,id,validName(name));
  socket.data.roomCode=room.code;socket.data.playerId=id;socket.join(room.code);
  sendState(room);return {ok:true,code:room.code,playerId:id,state:publicState(room,id)};
}
function current(socket){
  const room=rooms.get(socket.data.roomCode);if(!room||!room.players[socket.data.playerId])throw Error('Not in room');
  return {room,id:socket.data.playerId};
}
const safeAck=(handler,ack)=>{if(typeof ack!=='function')return;try{ack(handler());}catch(e){ack({ok:false,text:e?.message?.slice(0,120)||'Action rejected'});}};
io.use((socket,next)=>{
  if(io.engine.clientsCount>100)return next(new Error('Server is full'));
  next();
});
io.on('connection',socket=>{
  let actions=0,time=Date.now(),moves=0,moveTime=Date.now();
  socket.on('room:create',(data,ack)=>safeAck(()=>{
    if(rooms.size>=40)throw Error('Server has reached the room limit');
    let c=code();while(rooms.has(c))c=code();
    const room=newRoom(c);rooms.set(c,room);
    return join(socket,room,data?.name);
  },ack));
  socket.on('room:join',(data,ack)=>safeAck(()=>{
    const name=String(data?.code||'').trim().toUpperCase();
    if(!/^[A-F0-9]{6}$/.test(name))throw Error('Invalid room code');
    const room=rooms.get(name);if(!room)throw Error('Room not found');
    return join(socket,room,data?.name);
  },ack));
  socket.on('game:action',(data,ack)=>safeAck(()=>{
    const now=Date.now();if(now-time>=10000){time=now;actions=0;}
    if(++actions>42)throw Error('Too many actions. Slow down.');
    const {room,id}=current(socket),{event,payload={}}=data||{};
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid input');
    const text=JSON.stringify(payload);if(text.length>4000)throw Error('Action too large');
    let result;
    if(event==='terminal')result={ok:true,...terminalCommand(room,id,payload.line)};
    else if(event==='intrusion')result=intrusionInput(room,id,payload.key);
    else if(['start','market:verify','market:sell','buy','garden:plant','garden:harvest','garden:package','alley:drop','door:peek','door:open'].includes(event))
      result=gameAction(room,id,event,payload);
    else throw Error('Unknown action');
    sendState(room);return result;
  },ack));
  socket.on('player:move',position=>{
    const now=Date.now();if(now-moveTime>=1000){moveTime=now;moves=0;}
    if(++moves>18)return;
    try{const {room,id}=current(socket);movePlayer(room,id,position);sendState(room);}catch{}
  });
  socket.on('disconnect',()=>{
    try{
      const {room,id}=current(socket);
      delete room.players[id];delete room.terminals[id];delete room.intrusions[id];sendState(room);
      if(Object.keys(room.players).length===0)rooms.delete(room.code);
    }catch{}
  });
});
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values())if(tick(room,now))sendState(room);
},200).unref();
const PORT=Number(process.env.PORT||3000);
http.listen(PORT,'0.0.0.0',()=>console.log('DEAD DROP server ready on port '+PORT));
