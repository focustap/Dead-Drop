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
  const http=createServer(app),io=new Server(http,{maxHttpBufferSize:4096,cors:{origin:'*',methods:['GET','POST']}});
  const rooms=new Map(),joined=new Map(),sessions=new Map();
  const emitState=room=>{for(const [sid,entry] of joined){if(entry.code===room.code)io.sockets.sockets.get(sid)?.emit('state',publicState(room,entry.id));}};
  const roomFor=socket=>{const room=rooms.get(joined.get(socket.id)?.code);if(!room)throw Error('Join a room first.');return room;};
  const register=(socket,room,id,ack,token)=>{
    token=token||randomBytes(24).toString('hex');sessions.set(token,{code:room.code,id,expires:Infinity});
    joined.set(socket.id,{code:room.code,id,token});socket.join(room.code);room.players[id].connected=true;
    ack?.({ok:true,code:room.code,playerId:id,token,state:publicState(room,id)});emitState(room);
  };
  const ackError=(ack,error)=>ack?.({ok:false,text:String(error.message||'Unavailable').slice(0,160)});
  io.on('connection',socket=>{
    socket.on('room:create',(data={},ack)=>{
      try{
        if(joined.has(socket.id))throw Error('Already connected to a room.');
        if(rooms.size>=40)throw Error('Server full.');
        let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
        const room=newRoom(code);addPlayer(room,socket.id,data.name);rooms.set(code,room);
        gameAction(room,socket.id,'start');register(socket,room,socket.id,ack);
      }catch(error){ackError(ack,error);}
    });
    socket.on('room:join',(data={},ack)=>{
      try{
        if(joined.has(socket.id))throw Error('Already connected to a room.');
        const code=String(data.code||'').toUpperCase().trim();
        const room=rooms.get(code);if(!room)throw Error('Room not found.');
        addPlayer(room,socket.id,data.name);register(socket,room,socket.id,ack);
      }catch(error){ackError(ack,error);}
    });
    socket.on('room:resume',(data={},ack)=>{
      try{const token=data?.token,session=sessions.get(token),room=rooms.get(session?.code);
        if(joined.has(socket.id))throw Error('Already connected.');
        if(!session||!room||session.expires<Date.now()||room.players[session.id]?.connected)throw Error('Session expired. Join the room again.');
        register(socket,room,session.id,ack,token);
      }catch(error){ackError(ack,error);}
    });
    let lastMove=0,lastAction=Date.now(),actionBudget=12;
    let moveTimer=null,pendingMove=null;
    const flushMove=()=>{
      moveTimer=null;
      const room=rooms.get(joined.get(socket.id)?.code);
      if(!room||!pendingMove)return;
      const position=pendingMove;pendingMove=null;lastMove=Date.now();
      movePlayer(room,joined.get(socket.id).id,position);socket.to(room.code).emit('peers',Object.values(room.players));
    };
    socket.on('player:move',position=>{
      if(!joined.has(socket.id))return;
      pendingMove=position;
      if(moveTimer)return;
      const delay=55-(Date.now()-lastMove);
      if(delay<=0)flushMove();else moveTimer=setTimeout(flushMove,delay);
    });
    socket.on('game:action',(data={},ack)=>{
      try{
        const {event,payload}=data||{};
        const room=roomFor(socket),id=joined.get(socket.id).id;let output;
        const now=Date.now();actionBudget=Math.min(12,actionBudget+(now-lastAction)/50);lastAction=now;
        if(actionBudget<1)throw Error('Slow down.');actionBudget--;
        if(event==='terminal')output={ok:true,...terminalCommand(room,id,payload?.line)};
        else if(event==='intrusion')output=intrusionInput(room,id,payload?.key);
        else output=gameAction(room,id,event,payload);
        ack?.(output);emitState(room);
      }catch(error){ackError(ack,error);}
    });
    socket.on('disconnect',()=>{
      clearTimeout(moveTimer);pendingMove=null;
      const entry=joined.get(socket.id);if(!entry)return;
      joined.delete(socket.id);const room=rooms.get(entry.code);if(!room)return;
      room.players[entry.id].connected=false;sessions.get(entry.token).expires=Date.now()+120000;
      emitState(room);
    });
  });
  const interval=setInterval(()=>{
    for(const [token,session] of sessions)if(session.expires<Date.now()){
      const room=rooms.get(session.code);if(room){const p=room.players[session.id];if(p)room.inventory.buds+=p.carrying||0;delete room.players[session.id];delete room.terminals[session.id];delete room.intrusions[session.id];
      const remote=room.remoteSessions[session.id];if(remote){const target=room.remoteTargets[remote.target];if(target)target.owner=null;delete room.remoteSessions[session.id];}
      const challenge=room.challenges[session.id];if(challenge){const job=room.contracts.find(c=>c.id===challenge.id);if(job)job.owner=null;delete room.challenges[session.id];}
      if(!Object.keys(room.players).length)rooms.delete(session.code);else emitState(room);}sessions.delete(token);
    }
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
