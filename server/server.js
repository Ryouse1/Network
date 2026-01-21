const express = require("express");
const { exec } = require("child_process");
const dns = require("dns");
const app = express();

app.use(express.static("../public"));

function parsePing(out){
  const t=[...out.matchAll(/time=([\d.]+)/g)].map(m=>+m[1]);
  if(!t.length) return null;
  return {
    min: Math.min(...t),
    max: Math.max(...t),
    avg: t.reduce((a,b)=>a+b)/t.length,
    jitter: Math.max(...t)-Math.min(...t),
    loss: (5-t.length)*20
  };
}

app.get("/api/global-ip",(req,res)=>{
  res.json({
    ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress
  });
});

app.get("/api/ping",(req,res)=>{
  exec("ping -c 5 8.8.8.8",(e,out)=>{
    if(e) return res.json({ok:false});
    res.json(parsePing(out));
  });
});

app.get("/api/trace",(req,res)=>{
  exec("traceroute -m 10 8.8.8.8",(e,out)=>{
    if(e) return res.json({hop:99});
    res.json({hop: out.split("\n").length-1});
  });
});

app.get("/api/dns",(req,res)=>{
  const t=Date.now();
  dns.lookup("google.com",()=>res.json({latency:Date.now()-t}));
});

app.get("/api/score",(req,res)=>{
  exec("ping -c 5 8.8.8.8",(e,out)=>{
    if(e) return res.json({score:0,label:"Unknown"});
    const p=parsePing(out);

    let score=100;
    if(p.avg>30) score-=20;
    if(p.avg>60) score-=30;
    if(p.avg>100) score-=40;
    if(p.loss>0) score-=20;

    const label =
      score>80?"🟢 Local-like":
      score>50?"🟡 Normal":
      "🔴 Far";

    res.json({score,label,...p});
  });
});

app.listen(process.env.PORT||3000);
