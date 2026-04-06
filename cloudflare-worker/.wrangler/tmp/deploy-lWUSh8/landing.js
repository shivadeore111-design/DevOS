// landing.js
var landing_default = {
  async fetch(request, env) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DevOS \u2014 Aiden. Your Personal AI OS. Local. Private. Always On.</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0e0e0e;--bg1:#141414;--bg2:#1a1a1a;--bg3:#222;
  --b:#2a2a2a;--b2:#333;--b3:#3a3a3a;
  --text:#e8e8e8;--muted:#555;--muted2:#888;--muted3:#aaa;
  --orange:#f97316;--orange2:#fb923c;--odim:rgba(249,115,22,0.1);--odim2:rgba(249,115,22,0.18);
  --green:#22c55e;--gdim:rgba(34,197,94,0.12);
  --mono:'JetBrains Mono',monospace;--sans:'Outfit',sans-serif;
}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--sans);overflow-x:hidden;line-height:1.6}
canvas#bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
.z{position:relative;z-index:1}
.wrap{max-width:1080px;margin:0 auto;padding:0 32px}
nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(14,14,14,0.93);backdrop-filter:blur(18px);border-bottom:1px solid var(--b)}
.navi{display:flex;align-items:center;justify-content:space-between;height:52px;max-width:1080px;margin:0 auto;padding:0 32px}
.nlogo{display:flex;align-items:center;gap:9px;text-decoration:none;font-family:var(--mono);font-size:13px;color:var(--text)}
.lsq{width:24px;height:24px;border-radius:5px;background:var(--orange);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#000;font-family:var(--mono);flex-shrink:0}
.nbadge{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:11px;color:var(--green)}
.ndot{width:5px;height:5px;border-radius:50%;background:var(--green);animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
.nlinks{display:flex;align-items:center;gap:4px}
.nl{font-family:var(--mono);font-size:11px;color:var(--muted2);text-decoration:none;padding:4px 10px;border-radius:4px;transition:color .15s,background .15s}
.nl:hover{color:var(--text);background:var(--bg2)}
.ncta{font-family:var(--mono);font-size:11px;color:var(--orange);background:var(--odim);border:1px solid rgba(249,115,22,0.25);padding:4px 14px;border-radius:4px;text-decoration:none;transition:all .15s}
.ncta:hover{background:var(--odim2);border-color:rgba(249,115,22,0.5)}
.hero{padding:148px 0 88px}
.stag{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10px;color:var(--orange);letter-spacing:.12em;text-transform:uppercase;margin-bottom:20px}
.stag::before{content:'\u25CF';font-size:7px}
h1.hh{font-size:clamp(38px,5.5vw,72px);font-weight:800;line-height:1.08;letter-spacing:-.02em;margin-bottom:20px}
h1.hh .o{color:var(--orange)}
.hsub{font-family:var(--mono);font-size:13px;color:var(--muted2);max-width:580px;line-height:1.8;margin-bottom:36px}
.hsub strong{color:var(--muted3);font-weight:500}
.install-note{font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:48px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--b);border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-bottom:80px}
.sc{background:var(--bg1);padding:22px 18px;text-align:center}
.sn{font-family:var(--mono);font-size:28px;font-weight:700;color:var(--text);line-height:1;margin-bottom:3px}
.sn em{color:var(--orange);font-style:normal}
.sl{font-family:var(--mono);font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.shd{margin-bottom:32px}
.shd h2{font-size:clamp(22px,3vw,36px);font-weight:700;letter-spacing:-.02em;margin-top:6px}
.shd p{font-family:var(--mono);font-size:12px;color:var(--muted2);margin-top:6px;line-height:1.7}
.fg{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--b);border:1px solid var(--b);border-radius:12px;overflow:hidden;margin-bottom:80px}
.fc{background:var(--bg1);padding:26px 22px;transition:background .2s}
.fc:hover{background:var(--bg2)}
.ftag{font-family:var(--mono);font-size:9px;color:var(--orange);text-transform:uppercase;letter-spacing:.12em;margin-bottom:9px;display:flex;align-items:center;gap:5px}
.ftag::before{content:'\u25CF';font-size:6px}
.fc h3{font-size:14px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em}
.fc p{font-family:var(--mono);font-size:11px;color:var(--muted2);line-height:1.65}
.pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:12px}
.pl{font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:3px;background:var(--bg3);border:1px solid var(--b);color:var(--muted2)}
.pl.new{background:var(--odim);border-color:rgba(249,115,22,.2);color:var(--orange)}
.tools-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--b);border:1px solid var(--b);border-radius:12px;overflow:hidden;margin-bottom:80px}
.tool-card{background:var(--bg1);padding:22px 18px;transition:background .2s;cursor:default}
.tool-card:hover{background:var(--bg2)}
.tool-icon{width:28px;height:28px;margin-bottom:12px;color:var(--orange);opacity:.85}
.tool-icon svg{width:100%;height:100%}
.tool-name{font-size:13px;font-weight:600;margin-bottom:5px;letter-spacing:-.01em}
.tool-desc{font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.6}
.term{background:var(--bg1);border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-bottom:80px}
.tbar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid var(--b);background:rgba(0,0,0,.3)}
.td{width:9px;height:9px;border-radius:50%}
.td.r{background:#ff453a}.td.y{background:#ffd60a}.td.g{background:#32d74b}
.ttit{font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:4px}
.tbody{padding:20px 22px;font-family:var(--mono);font-size:12px;line-height:2;min-height:280px}
.tl{display:flex;gap:10px}
.tps{color:var(--orange)}.tcmd{color:var(--text)}
.tout{color:var(--muted2);padding-left:16px}
.tout.ok{color:var(--green)}.tout.ac{color:var(--orange)}.tout.am{color:#fbbf24}.tout.er{color:#f87171}
.tgap{height:4px}
.channels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:80px}
.ch{background:var(--bg1);border:1px solid var(--b);border-radius:8px;padding:20px;transition:border-color .2s;display:flex;gap:12px;align-items:flex-start}
.ch:hover{border-color:rgba(249,115,22,.2)}
.ch-icon{width:22px;height:22px;flex-shrink:0;color:var(--orange);opacity:.8}
.ch-icon svg{width:100%;height:100%}
.ch-name{font-size:13px;font-weight:600;margin-bottom:2px}
.ch-status{font-family:var(--mono);font-size:9px;margin-bottom:5px;font-weight:500}
.ch-status.live{color:var(--green)}.ch-status.soon{color:#fbbf24}
.ch-desc{font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.6}
.ui-mock{background:var(--bg1);border:1px solid var(--b);border-radius:12px;overflow:hidden;margin-bottom:32px}
.ui-mock-bar{display:flex;align-items:center;gap:6px;padding:10px 16px;border-bottom:1px solid var(--b);background:rgba(0,0,0,.35)}
.ui-local-badge{margin-left:auto;display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;color:var(--green)}
.ui-mock-body{display:grid;grid-template-columns:1fr 1px 360px;min-height:400px}
.ui-divider{background:var(--b)}
.ui-chat{display:flex;flex-direction:column;min-width:0}
.chat-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--b)}
.chat-hd-title{font-family:var(--mono);font-size:11px;color:var(--muted3);font-weight:500}
.chat-model-badge{font-family:var(--mono);font-size:9px;padding:2px 8px;border-radius:3px;background:var(--odim);border:1px solid rgba(249,115,22,.2);color:var(--orange)}
.chat-messages{flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.msg{display:flex;flex-direction:column;gap:3px;max-width:90%}
.msg.user{align-self:flex-end;align-items:flex-end}
.msg.ai{align-self:flex-start;align-items:flex-start}
.msg-lbl{font-family:var(--mono);font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}
.msg-bubble{padding:9px 13px;border-radius:8px;font-family:var(--mono);font-size:12px;line-height:1.6}
.msg.user .msg-bubble{background:var(--odim);border:1px solid rgba(249,115,22,.22);color:var(--text)}
.msg.ai .msg-bubble{background:var(--bg2);border:1px solid var(--b);color:var(--muted3)}
.chat-input-row{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--b)}
.chat-input-box{flex:1;background:var(--bg2);border:1px solid var(--b2);border-radius:6px;padding:8px 12px;font-family:var(--mono);font-size:12px;color:var(--muted3);min-height:34px;display:flex;align-items:center;gap:1px}
.chat-cursor{color:var(--orange);animation:blink .7s infinite;line-height:1;font-weight:300;font-size:14px}
.chat-send{width:32px;height:32px;background:var(--orange);border:none;border-radius:5px;color:#000;font-size:13px;cursor:pointer;flex-shrink:0;font-weight:700}
.ui-log{display:flex;flex-direction:column;background:rgba(0,0,0,.18)}
.log-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--b)}
.log-hd-title{font-family:var(--mono);font-size:11px;color:var(--muted3);font-weight:500}
.log-live{display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:9px;color:var(--green)}
.log-body{flex:1;padding:10px 14px;display:flex;flex-direction:column;gap:4px;overflow:hidden}
.log-entry{display:flex;gap:8px;align-items:flex-start;opacity:0;transform:translateX(6px);transition:opacity .35s,transform .35s}
.log-entry.show{opacity:1;transform:translateX(0)}
.log-time{font-family:var(--mono);font-size:9px;color:var(--muted);min-width:34px;padding-top:2px;flex-shrink:0}
.log-ic{font-size:12px;min-width:18px;padding-top:1px;flex-shrink:0}
.log-txt{font-family:var(--mono);font-size:10px;line-height:1.55;color:var(--muted2)}
.log-txt .ok{color:var(--green)}.log-txt .ac{color:var(--orange)}.log-txt .hi{color:var(--muted3)}
.ui-callouts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:80px}
.ui-callout{background:var(--bg1);border:1px solid var(--b);border-radius:8px;padding:20px;transition:border-color .2s}
.ui-callout:hover{border-color:rgba(249,115,22,.22)}
.uc-icon{font-size:18px;margin-bottom:9px}
.uc-title{font-size:13px;font-weight:600;margin-bottom:5px}
.uc-desc{font-family:var(--mono);font-size:11px;color:var(--muted);line-height:1.6}
.ag{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-bottom:80px}
.ac{background:var(--bg1);border:1px solid var(--b);border-radius:8px;padding:22px;transition:border-color .2s,background .15s}
.ac:hover{border-color:rgba(249,115,22,.22);background:var(--bg2)}
.ai{width:24px;height:24px;margin-bottom:12px;color:var(--orange);opacity:.75}
.ai svg{width:100%;height:100%}
.an{font-size:15px;font-weight:700;margin-bottom:4px}
.ar{font-family:var(--mono);font-size:10px;color:var(--orange);margin-bottom:8px}
.ad{font-family:var(--mono);font-size:11px;color:var(--muted2);line-height:1.6}
.cc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:40px}
.cc-card{background:var(--bg1);border:1px solid var(--b);border-radius:10px;padding:24px;transition:border-color .2s}
.cc-card:hover{border-color:rgba(249,115,22,.22)}
.cc-icon{width:28px;height:28px;margin-bottom:12px;color:var(--orange);opacity:.8}
.cc-icon svg{width:100%;height:100%}
.cc-name{font-size:14px;font-weight:600;margin-bottom:6px}
.cc-desc{font-family:var(--mono);font-size:11px;color:var(--muted2);line-height:1.6}
.cc-demo{background:var(--bg1);border:1px solid var(--b);border-radius:10px;padding:24px;margin-bottom:80px;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center}
.cc-demo-text h3{font-size:18px;font-weight:700;margin-bottom:10px}
.cc-demo-text p{font-family:var(--mono);font-size:11px;color:var(--muted2);line-height:1.7;margin-bottom:16px}
.cc-flow{background:var(--bg2);border:1px solid var(--b);border-radius:8px;padding:16px;font-family:var(--mono);font-size:11px;line-height:2}
.cc-flow .step{color:var(--muted2)}
.cc-flow .step .num{color:var(--orange);margin-right:8px}
.cc-flow .step .ok{color:var(--green)}
.sw-demo{background:var(--bg1);border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-bottom:80px}
.sw-bar{display:flex;align-items:center;gap:6px;padding:10px 14px;border-bottom:1px solid var(--b);background:rgba(0,0,0,.3)}
.sw-body{padding:24px;font-family:var(--mono);font-size:12px;line-height:2}
.sw-body .hi{color:var(--orange)}
.sw-body .ok{color:var(--green)}
.sw-body .dim{color:var(--muted)}
.who-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:80px}
.who-card{background:var(--bg1);border:1px solid var(--b);border-radius:10px;padding:20px 22px;transition:border-color .2s}
.who-card:hover{border-color:rgba(249,115,22,.22)}
.who-role{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px}
.who-task{font-family:var(--mono);font-size:12px;color:var(--muted2);line-height:1.7;font-style:italic}
.wl-wrap{padding:80px 0}
.wbox{background:var(--bg1);border:1px solid var(--b);border-radius:16px;padding:56px 48px;text-align:center;position:relative;overflow:hidden}
.wbox::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(249,115,22,0.06) 0%,transparent 60%);pointer-events:none}
.wbox h2{font-size:clamp(24px,3.5vw,42px);font-weight:800;letter-spacing:-.025em;margin-bottom:8px}
.wbox-p{font-family:var(--mono);font-size:12px;color:var(--muted2);max-width:420px;margin:0 auto 32px;line-height:1.7}
.wbadge{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10px;color:var(--muted2);background:var(--bg2);border:1px solid var(--b);border-radius:20px;padding:4px 12px;margin-bottom:24px}
.wbadge span{color:var(--green);font-weight:500}
.eform{display:flex;gap:8px;max-width:440px;margin:0 auto 24px;flex-wrap:wrap;justify-content:center}
.einput{flex:1;min-width:200px;background:var(--bg2);border:1px solid var(--b2);border-radius:6px;padding:10px 14px;font-family:var(--mono);font-size:12px;color:var(--text);outline:none;transition:border-color .2s}
.einput::placeholder{color:var(--muted)}
.einput:focus{border-color:rgba(249,115,22,.4)}
.einput.err{border-color:rgba(239,68,68,.5)!important}
.btnp{background:var(--orange);border:none;border-radius:6px;padding:10px 20px;font-family:var(--mono);font-size:12px;font-weight:600;color:#000;cursor:pointer;transition:opacity .15s,transform .1s;white-space:nowrap}
.btnp:hover{opacity:.88}
.btnp:active{transform:scale(.97)}
.wsuc{display:none;font-family:var(--mono);font-size:12px;color:var(--green);margin-bottom:20px}
.divtxt{font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:12px}
.ctarow{display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap}
.gbtn{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid var(--b2);border-radius:6px;padding:9px 16px;font-family:var(--mono);font-size:11px;color:var(--muted2);text-decoration:none;transition:all .15s;cursor:pointer}
.gbtn:hover{border-color:var(--b3);color:var(--text);background:var(--bg2)}
.gbtn svg{width:14px;height:14px;flex-shrink:0}
.gbtn.disc{border-color:rgba(88,101,242,.25);color:#7289da}
.gbtn.disc:hover{background:rgba(88,101,242,.07);border-color:rgba(88,101,242,.4)}
.fr-wrap{padding:0 0 80px}
.fr-box{background:var(--bg1);border:1px solid var(--b);border-radius:12px;overflow:hidden}
.fr-top{padding:28px 28px 0}
.fr-top h3{font-size:18px;font-weight:700;margin-bottom:4px}
.fr-top p{font-family:var(--mono);font-size:11px;color:var(--muted2);margin-bottom:20px}
.fr-form{background:var(--bg2);border:1px solid var(--b);border-radius:8px;padding:20px;margin-bottom:20px}
.fr-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.cat-btn{font-family:var(--mono);font-size:10px;padding:4px 10px;border-radius:4px;background:var(--bg3);border:1px solid var(--b);color:var(--muted2);cursor:pointer;transition:all .15s}
.cat-btn:hover{border-color:var(--b3);color:var(--text)}
.cat-btn.active{background:var(--odim);border-color:rgba(249,115,22,.35);color:var(--orange)}
.fr-ta{width:100%;background:var(--bg);border:1px solid var(--b2);border-radius:6px;padding:10px 12px;font-family:var(--mono);font-size:12px;color:var(--text);resize:none;outline:none;line-height:1.6;transition:border-color .2s;min-height:80px}
.fr-ta::placeholder{color:var(--muted)}
.fr-ta:focus{border-color:rgba(249,115,22,.35)}
.fr-submit-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:8px}
.fr-hint{font-family:var(--mono);font-size:10px;color:var(--muted)}
.fr-submit{background:var(--orange);border:none;border-radius:5px;padding:8px 18px;font-family:var(--mono);font-size:11px;font-weight:600;color:#000;cursor:pointer;transition:opacity .15s}
.fr-submit:hover{opacity:.85}
.fr-feed{border-top:1px solid var(--b)}
.fr-feed-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-bottom:1px solid var(--b)}
.fr-feed-hd span{font-family:var(--mono);font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:.08em}
.fr-feed-sort{display:flex;gap:4px}
.sort-btn{font-family:var(--mono);font-size:9px;padding:3px 8px;border-radius:3px;background:var(--bg2);border:1px solid var(--b);color:var(--muted);cursor:pointer;transition:all .15s}
.sort-btn.active{background:var(--bg3);color:var(--text);border-color:var(--b3)}
.fr-list{padding:0 28px 20px}
.fr-empty{font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;padding:36px 0}
.fr-item{display:flex;gap:12px;align-items:flex-start;padding:16px 0;border-bottom:1px solid var(--b)}
.fr-item:last-child{border-bottom:none}
.fr-vote{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:36px}
.vbtn{background:var(--bg2);border:1px solid var(--b);border-radius:4px;width:32px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;transition:all .15s;flex-shrink:0}
.vbtn:hover{border-color:rgba(249,115,22,.35);background:var(--odim)}
.vbtn.voted{background:var(--odim);border-color:rgba(249,115,22,.4);color:var(--orange)}
.vcount{font-family:var(--mono);font-size:11px;font-weight:600;color:var(--muted3)}
.fr-content{flex:1;min-width:0}
.fr-meta{display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap}
.cat-pill{font-family:var(--mono);font-size:9px;padding:2px 7px;border-radius:3px;background:var(--odim);border:1px solid rgba(249,115,22,.2);color:var(--orange)}
.fr-time{font-family:var(--mono);font-size:9px;color:var(--muted)}
.fr-text{font-family:var(--mono);font-size:12px;color:var(--muted3);line-height:1.6}
footer{border-top:1px solid var(--b);padding:32px 0}
.fi{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}
.flogo{display:flex;align-items:center;gap:7px;font-family:var(--mono);font-size:11px;color:var(--muted)}
.flinks{display:flex;gap:16px}
.flink{font-family:var(--mono);font-size:10px;color:var(--muted);text-decoration:none;transition:color .15s}
.flink:hover{color:var(--text)}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.a{opacity:0;animation:fadeUp .55s ease forwards}
.d1{animation-delay:.07s}.d2{animation-delay:.15s}.d3{animation-delay:.23s}.d4{animation-delay:.31s}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:var(--bg)}::-webkit-scrollbar-thumb{background:var(--b2);border-radius:2px}
.bench-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--b);border:1px solid var(--b);border-radius:12px;overflow:hidden;margin-bottom:80px}
.bench-card{background:var(--bg1);padding:28px 20px 20px;transition:background .2s;cursor:default}
.bench-card:hover{background:var(--bg2)}
.bench-title{font-family:var(--mono);font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:.1em;margin-bottom:20px}
.bench-bars{display:flex;align-items:flex-end;gap:8px;height:120px;margin-bottom:14px}
.bench-bar-wrap{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;height:100%}
.bench-bar-track{width:100%;flex:1;position:relative;display:flex;align-items:flex-end}
.bench-bar{width:100%;border-radius:4px 4px 0 0;height:0;transition:height 1s cubic-bezier(.22,1,.36,1);position:relative;cursor:pointer}
.bench-bar-label{font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center;white-space:nowrap}
.bench-note{font-family:var(--mono);font-size:10px;color:var(--muted);line-height:1.5;border-top:1px solid var(--b);padding-top:12px;margin-top:2px}
.bench-note .win-note{color:var(--orange)}
.bench-tip{position:fixed;background:var(--bg2);border:1px solid var(--b2);border-radius:6px;padding:8px 12px;font-family:var(--mono);font-size:11px;color:var(--muted3);pointer-events:none;z-index:200;display:none;max-width:220px;line-height:1.5}
.compare-legend{display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:32px;font-family:var(--mono);font-size:11px}
.compare-tagline{font-family:var(--mono);font-size:13px;color:var(--muted2);text-align:center;margin-top:24px;padding-top:24px;border-top:1px solid var(--b)}
.compare-tagline span{color:var(--orange)}
@media(max-width:900px){.fg{grid-template-columns:1fr 1fr}.tools-grid{grid-template-columns:repeat(3,1fr)}.channels{grid-template-columns:1fr 1fr}.stats{grid-template-columns:repeat(3,1fr)}.cc-grid{grid-template-columns:1fr 1fr}.cc-demo{grid-template-columns:1fr}.bench-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.fg,.channels,.cc-grid{grid-template-columns:1fr}.tools-grid{grid-template-columns:repeat(2,1fr)}.stats{grid-template-columns:1fr 1fr}.nlinks .nl{display:none}.hero{padding:110px 0 52px}.wbox{padding:36px 20px}.eform{flex-direction:column}.einput{min-width:unset}.ui-mock-body{grid-template-columns:1fr}.ui-divider,.ui-log{display:none}.ui-callouts{grid-template-columns:1fr}.bench-grid{grid-template-columns:1fr}.who-grid{grid-template-columns:1fr}.ag{grid-template-columns:1fr}}
</style>
</head>
<body>
<canvas id="bg"></canvas>

<nav>
  <div class="navi">
    <a class="nlogo" href="#"><div class="lsq">A/</div>DevOS \u2014 Aiden</a>
    <div class="nbadge"><span class="ndot"></span>beta \xB7 limited access</div>
    <div class="nlinks">
      <a class="nl" href="#features">features</a>
      <a class="nl" href="#computer">computer control</a>
      <a class="nl" href="#compare">why Aiden</a>
      <a class="nl" href="#request">roadmap</a>
      <a class="ncta" href="#waitlist">get early access \u2192</a>
    </div>
  </div>
</nav>

<!-- CINEMATIC INTRO -->
<section id="intro" style="position:relative;z-index:1;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 32px">
  <div id="introContent" style="opacity:0;transform:translateY(16px);transition:opacity 1.1s ease,transform 1.1s ease">
    <div style="font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.2em;text-transform:uppercase;margin-bottom:28px">by Taracod \xB7 White Lotus</div>
    <div id="glitchText" style="font-size:clamp(52px,10vw,130px);font-weight:900;letter-spacing:-.03em;line-height:1;color:var(--text);font-family:var(--sans);min-height:1.15em">&nbsp;</div>
    <div style="font-size:clamp(52px,10vw,130px);font-weight:900;letter-spacing:-.03em;line-height:1.05;min-height:1.2em">
      <span id="typewriterText" style="color:var(--orange)"></span><span id="twCursor" style="color:var(--orange);animation:blink .7s infinite;font-weight:900;font-family:var(--mono)">_</span>
    </div>
    <div id="introTagline" style="font-family:var(--mono);font-size:13px;color:var(--muted2);margin-top:32px;letter-spacing:.04em;opacity:0;transition:opacity .8s ease">Your personal AI. Runs on your machine. Remembers everything.</div>
  </div>
  <div id="scrollHint" style="position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0;transition:opacity .8s ease">
    <span style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:.15em;text-transform:uppercase">scroll</span>
    <div style="width:1px;height:32px;background:linear-gradient(to bottom,var(--orange),transparent)"></div>
  </div>
</section>

<section class="hero z">
  <div class="wrap">
    <div class="stag a d1">LOCAL-FIRST \xB7 PRIVATE \xB7 ALWAYS ON \xB7 BETA</div>
    <h1 class="hh a d2">Your AI works<br><span class="o">while you sleep.</span></h1>
    <p class="hsub a d3">
      Aiden is your personal AI that runs 100% on your machine.<br>
      <strong>It sees your screen, touches your files, remembers everything \u2014 and works even when you're not watching.</strong><br>
      Your data never leaves. Zero telemetry. Zero compromise.
    </p>
    <a href="#waitlist" class="ncta a d3" style="display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:48px">Get Early Access \u2192</a>
    <div class="stats a d4">
      <div class="sc"><div class="sn"><em>100%</em></div><div class="sl">local & private</div></div>
      <div class="sc"><div class="sn"><em>0</em></div><div class="sl">data sent to cloud</div></div>
      <div class="sc"><div class="sn"><em>24/7</em></div><div class="sl">always running</div></div>
      <div class="sc"><div class="sn"><em>\u221E</em></div><div class="sl">memory across sessions</div></div>
      <div class="sc"><div class="sn"><em>1-click</em></div><div class="sl">setup</div></div>
    </div>
  </div>
</section>

<!-- WHO USES AIDEN -->
<section id="who" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">FOR EVERYONE</div>
      <h2>Works for <span style="color:var(--orange)">any profession.</span> No coding required.</h2>
      <p>Aiden isn't just for developers. Anyone who works on a computer can use it. Just describe what you need in plain language \u2014 Aiden figures out the rest.</p>
    </div>
    <div class="who-grid">
      <div class="who-card"><div class="who-role">Trader</div><div class="who-task">"Monitor NSE every morning and alert me when Nifty drops 2%"</div></div>
      <div class="who-card"><div class="who-role">Writer</div><div class="who-task">"Research Victorian England and help me outline chapter 3 of my novel"</div></div>
      <div class="who-card"><div class="who-role">Doctor</div><div class="who-task">"Summarize these 50 patient notes and flag anything urgent"</div></div>
      <div class="who-card"><div class="who-role">Student</div><div class="who-task">"Explain quantum entanglement 5 different ways until I get it"</div></div>
      <div class="who-card"><div class="who-role">HR Manager</div><div class="who-task">"Screen these 200 resumes and shortlist the top 10 for the role"</div></div>
      <div class="who-card"><div class="who-role">Developer</div><div class="who-task">"Build a REST API, write tests, fix all errors, deploy to Vercel"</div></div>
      <div class="who-card"><div class="who-role">Analyst</div><div class="who-task">"Pull last quarter's data, find the anomalies, generate a report"</div></div>
      <div class="who-card"><div class="who-role">Designer</div><div class="who-task">"Research competitor landing pages and summarise what works best"</div></div>
      <div class="who-card"><div class="who-role">Anyone</div><div class="who-task">"Plan a week of healthy meals for a family of 4 with a nut allergy"</div></div>
    </div>
  </div>
</section>

<section id="features" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">HOW AIDEN WORKS</div>
      <h2>Built differently.<br><span style="color:var(--orange)">Works differently.</span></h2>
      <p>Aiden doesn't just answer questions \u2014 it plans, executes, verifies, and learns. Every action is checked before moving on. Every success is remembered for next time.</p>
    </div>
    <div class="fg">
      <div class="fc">
        <div class="ftag">Verified Execution</div>
        <h3>Every action confirmed</h3>
        <p>Before moving to the next step, Aiden checks that each action actually worked. Errors are detected, classified, and repaired automatically. Zero silent failures.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">auto-verified</span><span class="pl">auto-repair</span><span class="pl">no silent fails</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Goal to Done</div>
        <h3>Tell it what you want</h3>
        <p>Describe your goal in plain English. Aiden breaks it into steps, runs them in the right order, handles failures gracefully, and retries with a smarter approach each time.</p>
        <div class="pills"><span class="pl">parallel execution</span><span class="pl">smart retry</span><span class="pl">auto replan</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Shared Context</div>
        <h3>Always knows what's happening</h3>
        <p>Every part of Aiden shares the same context at all times \u2014 what the goal is, what's been done, what's next. Nothing falls through the cracks between steps.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">full context</span><span class="pl">no lost state</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Memory That Lasts</div>
        <h3>Remembers everything</h3>
        <p>Aiden remembers every conversation, every successful task pattern, every file you've shared \u2014 across sessions, forever. The longer you use it, the better it gets.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">cross-session</span><span class="pl">learns from success</span><span class="pl">local storage</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Learns From Your Files</div>
        <h3>Your knowledge, always available</h3>
        <p>Upload your documents, books, and notes. Aiden reads them, understands them, and uses that knowledge in every task. Your personal knowledge base, always private, always local.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">local & private</span><span class="pl">PDF \xB7 EPUB \xB7 MD \xB7 TXT</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Gets Smarter Over Time</div>
        <h3>Learns what works for you</h3>
        <p>After every successful task, Aiden captures what worked and uses it next time. The more you use it, the more capable it becomes \u2014 specifically for the way you work.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">auto-learning</span><span class="pl">personal to you</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Works On Any Machine</div>
        <h3>Auto-configures for your hardware</h3>
        <p>First run detects your GPU, RAM, and what's already installed. Aiden configures itself for your specific machine \u2014 never downloads what you already have, never overloads your system.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">hardware detection</span><span class="pl">smart auto-setup</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Built to Never Crash</div>
        <h3>Resilient by design</h3>
        <p>Every capability has its own timeout and automatic retries. One thing failing never crashes the whole task. Aiden keeps going and finds another way.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">isolated failures</span><span class="pl">automatic retry</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Any AI Model</div>
        <h3>Your model, your choice</h3>
        <p>Free local models work out of the box. Add any cloud API key for more power. Aiden automatically picks the right model for each part of a task \u2014 planning, execution, response.</p>
        <div class="pills"><span class="pl">free local models</span><span class="pl">groq</span><span class="pl">gemini</span><span class="pl">openai</span><span class="pl">+more</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Voice I/O</div>
        <h3>Talk to Aiden</h3>
        <p>Speech-to-text runs locally on your GPU \u2014 no cloud API, no latency. Aiden speaks responses back with a natural voice. Push-to-talk button built into the dashboard.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">local speech</span><span class="pl">natural voice</span><span class="pl">no cloud</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Deep Research</div>
        <h3>Real research, not just search</h3>
        <p>Aiden doesn't just search \u2014 it researches. Multiple passes, identifies gaps, fills them with targeted follow-up searches, and synthesises everything into a clear answer.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">multi-pass</span><span class="pl">gap detection</span><span class="pl">real sources</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Always Checks Before Acting</div>
        <h3>Plans before it does</h3>
        <p>Every plan is validated before execution begins. Bad plans are caught and rewritten automatically. Aiden never wastes time running a plan that won't work.</p>
        <div class="pills"><span class="pl new">new</span><span class="pl">pre-execution check</span><span class="pl">auto re-plan</span></div>
      </div>
    </div>
  </div>
</section>

<section id="tools" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">WHAT AIDEN CAN DO</div>
      <h2>Built-in capabilities.<br><span style="color:var(--orange)">No plugins needed.</span></h2>
      <p>Everything Aiden can do right out of the box \u2014 no setup, no extensions, no coding required.</p>
    </div>
    <div class="tools-grid">
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 9l3 3-3 3M13 15h3"/></svg></div><div class="tool-name">Run Commands</div><div class="tool-desc">Executes system commands on your machine \u2014 installs packages, runs scripts, anything you'd type yourself.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg></div><div class="tool-name">Create &amp; Edit Files</div><div class="tool-desc">Creates, reads, updates, and deletes files and folders anywhere on your computer.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div><div class="tool-name">Browse the Web</div><div class="tool-desc">Opens websites, clicks links, fills forms \u2014 operates a real browser just like you would.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div class="tool-name">Search the Web</div><div class="tool-desc">Searches across multiple sources with automatic fallback \u2014 always finds an answer, never gets blocked.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div><div class="tool-name">Run Python Code</div><div class="tool-desc">Writes and runs Python scripts \u2014 data analysis, automation, machine learning, anything Python can do.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><div class="tool-name">Run JavaScript</div><div class="tool-desc">Executes Node.js code \u2014 builds APIs, processes data, runs tests, interacts with packages.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><div class="tool-name">Windows Automation</div><div class="tool-desc">Runs Windows system scripts natively \u2014 manages settings, processes, services, and system tasks.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div><div class="tool-name">Send Notifications</div><div class="tool-desc">Sends desktop alerts when tasks complete, fail, or need your attention \u2014 always keeps you informed.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg></div><div class="tool-name">System Awareness</div><div class="tool-desc">Reads your GPU, CPU, RAM, and disk usage \u2014 Aiden knows your machine and works within its limits.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.3h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.1 6.1l1.06-.97a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div><div class="tool-name">Deploy to Vercel</div><div class="tool-desc">Pushes your project live to Vercel in one step \u2014 no manual dashboard or CLI needed.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg></div><div class="tool-name">Git &amp; GitHub</div><div class="tool-desc">Commits code, pushes to GitHub, manages branches \u2014 full version control built in.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div><div class="tool-name">Fetch Any URL</div><div class="tool-desc">Downloads content from any web address \u2014 APIs, JSON data, HTML pages, raw files.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg></div><div class="tool-name">Plugin Support</div><div class="tool-desc">Connects to any external tool or service \u2014 extend Aiden's capabilities without coding.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div><div class="tool-name">Screen Capture</div><div class="tool-desc">Takes screenshots of your screen \u2014 used for visual automation and computer control.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div><div class="tool-name">Mouse &amp; Keyboard</div><div class="tool-desc">Moves the mouse, clicks buttons, types text \u2014 real computer control on your actual machine.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><div class="tool-name">Deep Research</div><div class="tool-desc">Multi-pass research with gap detection \u2014 broad overview, then targeted follow-ups until nothing is missing.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div><div class="tool-name">Knowledge Base</div><div class="tool-desc">Upload your files \u2014 Aiden learns from them. PDF, EPUB, TXT, MD. Stays on your machine, always private.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg></div><div class="tool-name">Visual Automation</div><div class="tool-desc">Sees your screen, understands what's there, decides what to do \u2014 autonomous UI control without scripts.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="tool-name">Stock &amp; Market Data</div><div class="tool-desc">NSE/BSE and global market data \u2014 top gainers, losers, prices, pulled in real time.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></div><div class="tool-name">Voice Input</div><div class="tool-desc">Local speech-to-text \u2014 talk to Aiden hands-free. Runs on your GPU, nothing goes to any server.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></div><div class="tool-name">Voice Output</div><div class="tool-desc">Aiden speaks responses back with a natural voice. No cloud service needed \u2014 runs locally.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div><div class="tool-name">Learns as it Works</div><div class="tool-desc">After every successful task, Aiden captures what worked and applies it automatically next time.</div></div>
      <div class="tool-card"><div class="tool-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div><div class="tool-name">Scheduled Tasks</div><div class="tool-desc">Set tasks in plain English \u2014 "every Monday at 9am" \u2014 and Aiden handles them automatically in the background.</div></div>
    </div>
    <div class="term">
      <div class="tbar">
        <div class="td r"></div><div class="td y"></div><div class="td g"></div>
        <span class="ttit">aiden \u2014 live</span>
        <span style="margin-left:auto;font-family:var(--mono);font-size:9px;color:var(--green);display:flex;align-items:center;gap:5px"><span style="width:5px;height:5px;border-radius:50%;background:var(--green);display:inline-block;animation:blink 1.2s infinite"></span>local \xB7 no data sent</span>
      </div>
      <div class="tbody" id="termBody" style="min-height:280px"></div>
    </div>
  </div>
</section>

<!-- COMPUTER CONTROL -->
<section id="computer" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">COMPUTER CONTROL</div>
      <h2>Aiden can control your computer.</h2>
      <p>Aiden sees your screen, understands what's there, and takes action. It tries the smart way first, falls back to visual control if needed, and always asks before doing anything risky.</p>
    </div>
    <div class="cc-grid">
      <div class="cc-card">
        <div class="cc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></div>
        <div class="cc-name">Screen Vision</div>
        <div class="cc-desc">Aiden takes a screenshot, understands what's on the screen, decides what to do, does it, and verifies it worked. Repeats until the goal is done. All locally, all safely.</div>
      </div>
      <div class="cc-card">
        <div class="cc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8l-2 4h12z"/></svg></div>
        <div class="cc-name">Smart Execution</div>
        <div class="cc-desc">Aiden checks if a service has a proper API before touching the UI. Gmail, Sheets, GitHub, Notion \u2014 it uses their APIs directly. Screen automation is the fallback, not the default. Far more reliable.</div>
      </div>
      <div class="cc-card">
        <div class="cc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
        <div class="cc-name">Safety Gate</div>
        <div class="cc-desc">Before any risky action \u2014 file deletion, sending something externally, anything destructive \u2014 Aiden stops and asks for your approval. You're always in control. 60 second timeout.</div>
      </div>
    </div>
    <div class="cc-demo">
      <div class="cc-demo-text">
        <h3>How it works in practice</h3>
        <p>Give Aiden a goal like "reply to my unread emails" and watch it figure out the best approach. It checks for a direct API first, uses it if available, falls back to screen control if not. Every step is verified before moving on.</p>
        <div class="pills">
          <span class="pl new">smart first</span>
          <span class="pl">screen vision</span>
          <span class="pl">always verified</span>
          <span class="pl">learns for next time</span>
        </div>
      </div>
      <div class="cc-flow">
        <div class="step"><span class="num">1</span>"Reply to my unread emails"</div>
        <div class="step"><span class="num">2</span><span style="color:var(--orange)">Safety Gate</span> \u2192 approval requested</div>
        <div class="step"><span class="num">3</span><span style="color:var(--orange)">Smart Execution</span> \u2192 Gmail API found \u2713</div>
        <div class="step"><span class="num">4</span><span style="color:var(--orange)">Screen Vision</span> \u2192 screenshot taken</div>
        <div class="step"><span class="num">5</span>Action decided \xB7 confidence: high</div>
        <div class="step"><span class="num">6</span><span style="color:var(--green)">Verified</span> \u2192 email sent \u2713</div>
        <div class="step"><span class="num">7</span><span style="color:var(--green)">Learned</span> \u2192 pattern saved for next time</div>
        <div class="step"><span class="num">8</span><span style="color:var(--green)">Done in 2 steps \xB7 faster next time</span></div>
      </div>
    </div>
  </div>
</section>

<!-- SETUP -->
<section id="setup" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">FIRST RUN</div>
      <h2>Scans your machine.<br><span style="color:var(--orange)">Configures itself.</span></h2>
      <p>Aiden detects your hardware on first run and sets itself up accordingly. Works on any Windows machine \u2014 high-end gaming PC or a budget laptop. Never asks you to configure anything manually.</p>
    </div>
    <div class="sw-demo">
      <div class="sw-bar">
        <div class="td r"></div><div class="td y"></div><div class="td g"></div>
        <span style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:6px">aiden \u2014 first run</span>
      </div>
      <div class="sw-body">
        <span style="color:var(--orange)">\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510</span><br>
        <span style="color:var(--orange)">\u2502  Aiden \u2014 First Run                      \u2502</span><br>
        <span style="color:var(--orange)">\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518</span><br><br>
        <span class="dim">Scanning your machine...</span><br><br>
        &nbsp;&nbsp;GPU &nbsp;&nbsp;&nbsp;\u2192 &nbsp;<span class="hi">NVIDIA GTX 1060 \xB7 6GB \xB7 Ready</span><br>
        &nbsp;&nbsp;RAM &nbsp;&nbsp;&nbsp;\u2192 &nbsp;<span class="hi">16GB \xB7 Good</span><br>
        &nbsp;&nbsp;OS &nbsp;&nbsp;&nbsp;&nbsp;\u2192 &nbsp;<span class="hi">Windows 11</span><br><br>
        <span class="dim">Configuring Aiden for your hardware...</span><br><br>
        &nbsp;&nbsp;AI models &nbsp;&nbsp;\u2192 &nbsp;<span class="ok">Free cloud providers ready \u2713</span><br>
        &nbsp;&nbsp;Memory &nbsp;&nbsp;&nbsp;&nbsp;\u2192 &nbsp;<span class="ok">Local storage initialised \u2713</span><br>
        &nbsp;&nbsp;Voice &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;\u2192 &nbsp;<span class="ok">Speech enabled \u2713</span><br>
        &nbsp;&nbsp;Dashboard &nbsp;\u2192 &nbsp;<span class="ok">Opening at localhost:3000 \u2713</span><br><br>
        &nbsp;&nbsp;<span class="ok">\u2705 Aiden is ready. Say hello.</span>
      </div>
    </div>
  </div>
</section>

<section id="ui" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">DASHBOARD</div>
      <h2>Say it. Aiden does it.<br><span style="color:var(--orange)">You watch it happen.</span></h2>
      <p>Chat like a human. Every action Aiden takes streams live on the right \u2014 full transparency, no black box. Runs completely locally.</p>
    </div>
    <div class="ui-mock">
      <!-- Window bar -->
      <div class="ui-mock-bar">
        <div class="td r"></div><div class="td y"></div><div class="td g"></div>
        <span class="ttit">DevOS \u2014 Aiden</span>
        <span class="ui-local-badge"><span class="ndot" style="background:var(--green)"></span>local \xB7 offline capable</span>
      </div>
      <!-- Two column layout -->
      <div style="display:grid;grid-template-columns:1fr 1px 340px;min-height:360px">

        <!-- LEFT: Chat -->
        <div style="display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--b)">
            <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text)">Chat with Aiden</span>
            <span style="font-family:var(--mono);font-size:10px;color:var(--green);background:rgba(34,197,94,.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(34,197,94,.2)">local \xB7 free</span>
          </div>
          <div style="flex:1;padding:20px 16px;display:flex;flex-direction:column;gap:14px;overflow:hidden">

            <!-- User message -->
            <div style="display:flex;justify-content:flex-end">
              <div style="background:var(--orange);color:#000;font-family:var(--mono);font-size:11px;padding:8px 12px;border-radius:8px 8px 2px 8px;max-width:75%;line-height:1.5">
                Research AI trends in India and save a report
              </div>
            </div>

            <!-- Aiden response -->
            <div style="display:flex;gap:8px;align-items:flex-start">
              <div style="width:22px;height:22px;border-radius:5px;background:var(--orange);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#000;flex-shrink:0;font-family:var(--mono)">A/</div>
              <div style="background:var(--bg2);border:1px solid var(--b);font-family:var(--mono);font-size:11px;padding:8px 12px;border-radius:2px 8px 8px 8px;max-width:85%;line-height:1.6;color:var(--muted3)">
                On it. Running 3-pass deep research across 4 sources.<br>
                <span style="color:var(--green)">Saving to ai_trends_india_2026.md</span>
              </div>
            </div>

            <!-- User message 2 -->
            <div style="display:flex;justify-content:flex-end">
              <div style="background:var(--orange);color:#000;font-family:var(--mono);font-size:11px;padding:8px 12px;border-radius:8px 8px 2px 8px;max-width:75%;line-height:1.5">
                Remind me every day at 9am to check it
              </div>
            </div>

            <!-- Aiden response 2 -->
            <div style="display:flex;gap:8px;align-items:flex-start">
              <div style="width:22px;height:22px;border-radius:5px;background:var(--orange);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#000;flex-shrink:0;font-family:var(--mono)">A/</div>
              <div style="background:var(--bg2);border:1px solid var(--b);font-family:var(--mono);font-size:11px;padding:8px 12px;border-radius:2px 8px 8px 8px;max-width:85%;line-height:1.6;color:var(--muted3)">
                Done \u2014 scheduled daily at 9:00 AM.<br>
                <span style="color:var(--orange)">I'll remember this even if you restart.</span>
              </div>
            </div>

          </div>
          <!-- Input bar -->
          <div style="padding:10px 12px;border-top:1px solid var(--b);display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--bg2);border:1px solid var(--b2);border-radius:6px;padding:8px 12px;font-family:var(--mono);font-size:11px;color:var(--muted2)">Ask Aiden anything...</div>
            <button style="width:30px;height:30px;background:var(--orange);border:none;border-radius:5px;color:#000;font-size:14px;cursor:default;display:flex;align-items:center;justify-content:center">\u21B5</button>
          </div>
        </div>

        <!-- DIVIDER -->
        <div style="background:var(--b)"></div>

        <!-- RIGHT: Live Activity -->
        <div style="display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--b)">
            <span style="font-family:var(--mono);font-size:12px;font-weight:600;color:var(--text)">Live Activity</span>
            <span style="display:flex;align-items:center;gap:5px;font-family:var(--mono);font-size:10px;color:var(--green)"><span class="ndot"></span>live</span>
          </div>
          <div style="flex:1;padding:14px 14px;display:flex;flex-direction:column;gap:10px">

            <!-- Activity items -->
            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:01</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--muted3)">Scanning your machine</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:02</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px"><span style="color:var(--orange)">Open windows</span> <span style="color:var(--muted2)">\u2192 VS Code, Chrome (12 tabs), Spotify</span></div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:03</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--muted3)">System \u2192 6.2GB RAM free \xB7 disk 78% full</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:04</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px"><span style="color:var(--green)">Context ready</span> <span style="color:var(--muted2)">\xB7 responding with awareness</span></div>
              </div>
            </div>

            <div style="height:1px;background:var(--b);margin:2px 0"></div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:01</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--muted3)">Running multi-pass search</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:02</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px"><span style="color:var(--orange)">Web search</span> <span style="color:var(--muted2)">\u2192 fetching 4 sources</span></div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:03</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px;color:var(--muted2)">Gap detected \u2192 searching for funding data</div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:04</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px"><span style="color:var(--orange)">Saving</span> <span style="color:var(--muted2)">\u2192 ai_trends_india_2026.md</span></div>
              </div>
            </div>

            <div style="display:flex;gap:10px;align-items:flex-start">
              <span style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px;flex-shrink:0">00:05</span>
              <div>
                <div style="font-family:var(--mono);font-size:10px"><span style="color:var(--green)">Done</span> <span style="color:var(--muted2)">\xB7 3 passes \xB7 14,200 chars</span></div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
    <div class="ui-callouts">
      <div class="ui-callout"><div class="uc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div class="uc-title">Natural language</div><div class="uc-desc">Talk to Aiden like a person. No syntax required \u2014 just describe what you want done.</div></div>
      <div class="ui-callout"><div class="uc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></div><div class="uc-title">Real actions, verified</div><div class="uc-desc">Creates files, runs code, deploys apps, controls your computer \u2014 every action confirmed before moving on.</div></div>
      <div class="ui-callout"><div class="uc-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div class="uc-title">Full transparency</div><div class="uc-desc">Every action Aiden takes streams in real time. You always know exactly what it's doing and why.</div></div>
    </div>
  </div>
</section>

<!-- 4-MODE DASHBOARD -->
<section id="dashboard-modes" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">DASHBOARD \xB7 4 MODES</div>
      <h2>The UI adapts to what<br><span style="color:var(--orange)">you are doing.</span></h2>
      <p>One interface, four contexts. Switches automatically based on what is happening. Every mode is keyboard-accessible.</p>
    </div>
    <div class="fg">
      <div class="fc">
        <div class="ftag">Default</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5" opacity=".8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <h3 style="margin:0">Focus Mode</h3>
        </div>
        <p>Only chat visible. Clean and distraction-free. Best for composing requests and reviewing results.</p>
        <div class="pills"><span class="pl">default</span><span class="pl">chat only</span><span class="pl">minimal</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Auto-triggers on task start</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5" opacity=".8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          <h3 style="margin:0">Execution Mode</h3>
        </div>
        <p>Live activity panel slides in automatically when a task starts. Watch every action in real time as Aiden works.</p>
        <div class="pills"><span class="pl new">auto</span><span class="pl">live view</span><span class="pl">activity feed</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Ctrl+P</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5" opacity=".8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <h3 style="margin:0">Power Mode</h3>
        </div>
        <p>All panels open simultaneously \u2014 history, chat, and live activity. Full context alongside real-time execution.</p>
        <div class="pills"><span class="pl">ctrl+p</span><span class="pl">all panels</span><span class="pl">full context</span></div>
      </div>
      <div class="fc">
        <div class="ftag">Demo + Watch</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" stroke-width="1.5" opacity=".8"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          <h3 style="margin:0">Watch Mode</h3>
        </div>
        <p>Live view expands fullscreen. Watch Aiden control your screen in real time. The mode that makes demos impossible to ignore.</p>
        <div class="pills"><span class="pl">fullscreen</span><span class="pl">screen stream</span><span class="pl">demo</span></div>
      </div>
    </div>
  </div>
</section>

<section id="channels" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">ACCESS FROM ANYWHERE</div>
      <h2>Control Aiden from anywhere.</h2>
      <p>Send a goal from your phone. Get results on any device. Multiple ways to reach Aiden \u2014 all working out of the box.</p>
    </div>
    <div class="channels">
      <div class="ch"><div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><div><div class="ch-name">Web Dashboard</div><div class="ch-status live">\u25CF Live</div><div class="ch-desc">Full chat interface with live activity feed and conversation history. Access from any browser on your network.</div></div></div>
      <div class="ch"><div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.16 4.99a10 10 0 0 0-17.84 8.02L2 22l9.07-1.31a10 10 0 0 0 10.09-15.7z"/></svg></div><div><div class="ch-name">Telegram</div><div class="ch-status live">\u25CF Live</div><div class="ch-desc">Send goals from your phone. Approve risky actions via inline keyboard. Get notified when tasks complete.</div></div></div>
      <div class="ch"><div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6.1 6.1l.93-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div><div><div class="ch-name">WhatsApp</div><div class="ch-status live">\u25CF Live</div><div class="ch-desc">Send goals from your number. Get completion notifications. No third-party API \u2014 runs entirely on your machine.</div></div></div>
      <div class="ch"><div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div><div><div class="ch-name">Discord</div><div class="ch-status live">\u25CF Live</div><div class="ch-desc">Goal notifications to any channel or DM. Auto-starts when configured.</div></div></div>
      <div class="ch"><div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 2H3v16h5v4l4-4h5l4-4V2zM11 11V7M16 11V7"/></svg></div><div><div class="ch-name">Slack</div><div class="ch-status live">\u25CF Live</div><div class="ch-desc">Start goals via DM. Completion and failure notifications to any channel.</div></div></div>
      <div class="ch"><div class="ch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div><div><div class="ch-name">Email</div><div class="ch-status live">\u25CF Live</div><div class="ch-desc">Email a goal and get a reply when it's done. Full execution summary included.</div></div></div>
    </div>
  </div>
</section>

<section id="capabilities" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">WHAT AIDEN SPECIALISES IN</div>
      <h2>Expert across every domain.</h2>
      <p>Aiden automatically applies the right expertise for your task. You describe the goal \u2014 Aiden figures out the best approach.</p>
    </div>
    <div class="ag">
      <div class="ac">
        <div class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
        <div class="an">Research</div>
        <div class="ar">Intelligence & Investigation</div>
        <div class="ad">Deep web research, market analysis, competitive intelligence, fact-checking. Multi-pass with gap detection \u2014 nothing gets missed.</div>
      </div>
      <div class="ac">
        <div class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg></div>
        <div class="an">Code & Engineering</div>
        <div class="ar">Build, Debug, Deploy</div>
        <div class="ad">Writes, tests, and deploys code across any language. Debugs systematically. Auto-rolls back on deploy failure. Works end to end.</div>
      </div>
      <div class="ac">
        <div class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
        <div class="an">Files & Data</div>
        <div class="ar">Organise, Analyse, Process</div>
        <div class="ad">Reads, writes, and organises your files. Analyses spreadsheets, PDFs, and documents. Generates reports. Processes data with Python.</div>
      </div>
      <div class="ac">
        <div class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></div>
        <div class="an">Computer Control</div>
        <div class="ar">Automate Anything</div>
        <div class="ad">Sees your screen and takes action. Clicks, types, opens apps, fills forms. Works on any application without special setup.</div>
      </div>
      <div class="ac">
        <div class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
        <div class="an">Analysis & Finance</div>
        <div class="ar">Data, Markets, Insights</div>
        <div class="ad">SQL queries, data visualisation, stock and market data, financial analysis. Numbers with confidence \u2014 always shows its working.</div>
      </div>
      <div class="ac">
        <div class="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
        <div class="an">Writing & Content</div>
        <div class="ar">Draft, Edit, Publish</div>
        <div class="ad">Emails, reports, documentation, marketing copy, SEO content. Active voice, clear structure \u2014 never invents facts.</div>
      </div>
    </div>
  </div>
</section>

<section id="compare" class="z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">WHY AIDEN</div>
      <h2>What living on your machine<br><span style="color:var(--orange)">actually means.</span></h2>
      <p>Cloud AI is powerful. But it lives in a browser tab, forgets you exist between sessions, and can never touch your computer. Aiden is different in ways that matter.</p>
    </div>
    <div style="position:relative;margin-bottom:32px">
      <!-- Orange glow blobs behind the table -->
      <div style="position:absolute;top:-60px;left:-40px;width:320px;height:320px;background:radial-gradient(circle,rgba(249,115,22,0.18) 0%,transparent 70%);pointer-events:none;z-index:0;filter:blur(40px)"></div>
      <div style="position:absolute;bottom:-40px;right:-40px;width:260px;height:260px;background:radial-gradient(circle,rgba(249,115,22,0.12) 0%,transparent 70%);pointer-events:none;z-index:0;filter:blur(50px)"></div>
      <!-- Glass table -->
      <div style="position:relative;z-index:1;background:rgba(20,20,20,0.55);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(249,115,22,0.18);border-radius:18px;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.04)">
        <!-- Header -->
        <div style="display:grid;grid-template-columns:1fr 180px 180px;border-bottom:1px solid rgba(249,115,22,0.12);background:rgba(249,115,22,0.04)">
          <div style="padding:18px 28px;font-family:var(--mono);font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em">Capability</div>
          <div style="padding:18px 28px;font-family:var(--mono);font-size:12px;font-weight:700;color:var(--orange);text-align:center;border-left:1px solid rgba(249,115,22,0.15);letter-spacing:.04em">Aiden</div>
          <div style="padding:18px 28px;font-family:var(--mono);font-size:12px;font-weight:600;color:var(--muted2);text-align:center;border-left:1px solid rgba(249,115,22,0.15);letter-spacing:.04em">Cloud AI</div>
        </div>
        <!-- Rows -->
        <div id="compareRows"></div>
      </div>
    </div>
    <div style="font-family:var(--mono);font-size:13px;color:var(--muted2);text-align:center;padding:8px 0 48px">
      <span style="color:var(--orange)">"Cloud AI answers questions.</span> Aiden does things."
    </div>
  </div>
</section>

<section class="wl-wrap z" id="waitlist">
  <div class="wrap">
    <div class="wbox">
      <div class="stag" style="justify-content:center;margin-bottom:16px">EARLY ACCESS \xB7 BETA \xB7 LIMITED SPOTS</div>
      <div class="wbadge"><span class="ndot" style="background:var(--orange)"></span>&nbsp;Beta \xB7 Limited spots</div>
      <h2>Get early access to Aiden</h2>
      <p class="wbox-p">Aiden is in active beta. Enter your email and we'll send you a download link directly. No waitlist delay \u2014 if there's a spot, you get access immediately.</p>
      <form id="eform" onsubmit="joinWL(event)">
        <div class="eform">
          <input class="einput" type="email" name="email" id="einp" placeholder="your@email.com" required autocomplete="email">
          <button type="submit" class="btnp">Get Early Access \u2192</button>
        </div>
      </form>
      <div class="wsuc" id="wsuc">&#10003; Check your email \u2014 your Aiden download link is waiting.</div>
      <div class="divtxt">or connect via</div>
      <div class="ctarow">
        <a class="gbtn disc" href="https://discord.gg/8mBwwBcp" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.077.077 0 0 0 .03.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
          Join Discord
        </a>
        <a class="gbtn" href="https://x.com/shivafpx" target="_blank" rel="noopener" style="border-color:rgba(255,255,255,.12);color:var(--muted2)">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.745l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          Follow on X
        </a>
      </div>
    </div>
  </div>
</section>

<section id="request" class="fr-wrap z">
  <div class="wrap">
    <div class="shd">
      <div class="stag">ROADMAP</div>
      <h2>What should we build next?</h2>
      <p>Submit a feature request. Upvote what others are asking for. We read every single one.</p>
    </div>
    <div class="fr-box">
      <div class="fr-top">
        <h3>Request a feature</h3>
        <p>Pick a category and describe your idea briefly.</p>
        <div class="fr-form">
          <div class="fr-cats" id="catRow">
            <button class="cat-btn active" onclick="selectCat(this,'tools')">tools</button>
            <button class="cat-btn" onclick="selectCat(this,'automation')">automation</button>
            <button class="cat-btn" onclick="selectCat(this,'memory')">memory</button>
            <button class="cat-btn" onclick="selectCat(this,'channels')">channels</button>
            <button class="cat-btn" onclick="selectCat(this,'voice')">voice</button>
            <button class="cat-btn" onclick="selectCat(this,'privacy')">privacy</button>
            <button class="cat-btn" onclick="selectCat(this,'other')">other</button>
          </div>
          <textarea class="fr-ta" id="frText" placeholder="e.g. Add a Notion integration so Aiden can read and write directly to my pages..." rows="3"></textarea>
          <div class="fr-submit-row">
            <span class="fr-hint" id="frHint">Select a category and describe your idea.</span>
            <button class="fr-submit" onclick="submitReq()">Submit Request \u2192</button>
          </div>
        </div>
      </div>
      <div class="fr-feed">
        <div class="fr-feed-hd">
          <span id="reqCount">0 requests</span>
          <div class="fr-feed-sort">
            <button class="sort-btn active" onclick="sortBy('votes',this)">top</button>
            <button class="sort-btn" onclick="sortBy('new',this)">new</button>
          </div>
        </div>
        <div class="fr-list" id="frList">
          <div class="fr-empty" id="frEmpty">No requests yet \u2014 be the first to suggest something!</div>
        </div>
      </div>
    </div>
  </div>
</section>

<footer class="z">
  <div class="wrap">
    <div class="fi">
      <div class="flogo">
        <div class="lsq" style="width:20px;height:20px;font-size:9px;border-radius:4px">A/</div>
        DevOS \xB7 Aiden \xA9 2026 \xB7 Built by <a href="https://taracod.com" target="_blank" rel="noopener" style="color:var(--orange);text-decoration:none">Shiva Deore</a> \xB7 <a href="https://taracod.com" target="_blank" rel="noopener" style="color:var(--orange);text-decoration:none">Taracod</a> \xB7 White Lotus
      </div>
      <div class="flinks">
        <a class="flink" href="#who">who uses it</a>
        <a class="flink" href="#features">what it does</a>
        <a class="flink" href="#computer">computer control</a>
        <a class="flink" href="#capabilities">capabilities</a>
        <a class="flink" href="#compare">why aiden</a>
        <a class="flink" href="#waitlist">get access</a>
        <a class="flink" href="#request">roadmap</a>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <a href="https://discord.gg/8mBwwBcp" target="_blank" rel="noopener" style="font-family:var(--mono);font-size:10px;color:var(--muted);text-decoration:none" onmouseover="this.style.color='#7289da'" onmouseout="this.style.color='var(--muted)'">Discord</a>
        <span style="color:var(--b2)">\xB7</span>
        <a href="https://x.com/shivafpx" target="_blank" rel="noopener" style="font-family:var(--mono);font-size:10px;color:var(--muted);text-decoration:none" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--muted)'">X / Twitter</a>
      </div>
    </div>
  </div>
</footer>
<div style="background:var(--bg1);border-top:1px solid var(--b);padding:10px 32px;font-family:var(--mono);font-size:9px;color:var(--muted);text-align:center">
  \xA9 2026 White Lotus \xB7 Taracod \xB7 All rights reserved \xB7 contact@taracod.com
</div>

<script>
// Cinematic intro \u2014 DevOS glitch+settle, Aiden typewriter
(function(){
  const GLITCH_CHARS='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*<>/\\\\[]{}';
  const FINAL_TEXT='DevOS';
  const TYPEWRITER_TEXT='Aiden';

  function randChar(){return GLITCH_CHARS[Math.floor(Math.random()*GLITCH_CHARS.length)]}

  function glitchSettle(el,finalText,duration,cb){
    const steps=18;
    const interval=duration/steps;
    let step=0;
    const settled=[];
    const timer=setInterval(()=>{
      step++;
      const progress=step/steps;
      // How many chars are settled = proportional to progress
      const numSettled=Math.floor(progress*finalText.length);
      let display='';
      for(let i=0;i<finalText.length;i++){
        if(i<numSettled){
          display+=finalText[i];
        } else if(finalText[i]===' '){
          display+=' ';
        } else {
          display+=randChar();
        }
      }
      el.textContent=display;
      if(step>=steps){
        clearInterval(timer);
        el.textContent=finalText;
        if(cb)cb();
      }
    },interval);
  }

  function typewriter(el,text,speed,cb){
    let i=0;
    el.textContent='';
    const timer=setInterval(()=>{
      el.textContent+=text[i];
      i++;
      if(i>=text.length){
        clearInterval(timer);
        if(cb)cb();
      }
    },speed);
  }

  // Fade in container
  setTimeout(()=>{
    const ic=document.getElementById('introContent');
    if(ic){ic.style.opacity='1';ic.style.transform='translateY(0)'}
  },300);

  // Start glitch on DevOS after fade in
  setTimeout(()=>{
    const glitch=document.getElementById('glitchText');
    if(!glitch)return;
    glitchSettle(glitch,FINAL_TEXT,700,()=>{
      // After DevOS settles, start Aiden typewriter
      setTimeout(()=>{
        const tw=document.getElementById('typewriterText');
        if(!tw)return;
        typewriter(tw,TYPEWRITER_TEXT,90,()=>{
          // Hide cursor blink after done, show tagline
          setTimeout(()=>{
            const cursor=document.getElementById('twCursor');
            if(cursor)cursor.style.opacity='0';
            const tagline=document.getElementById('introTagline');
            if(tagline)tagline.style.opacity='1';
            // Show scroll hint
            setTimeout(()=>{
              const sh=document.getElementById('scrollHint');
              if(sh)sh.style.opacity='1';
            },400);
          },600);
        });
      },200);
    });
  },800);

  // Fade out on scroll + replay when back at top
  let hasReplayed=false;
  let isAnimating=false;

  function runIntroAnimation(){
    if(isAnimating)return;
    isAnimating=true;
    hasReplayed=true;

    // Reset state
    const glitch=document.getElementById('glitchText');
    const tw=document.getElementById('typewriterText');
    const cursor=document.getElementById('twCursor');
    const tagline=document.getElementById('introTagline');
    const sh=document.getElementById('scrollHint');
    if(glitch)glitch.textContent='\xA0';
    if(tw)tw.textContent='';
    if(cursor){cursor.style.opacity='1';}
    if(tagline)tagline.style.opacity='0';
    if(sh)sh.style.opacity='0';

    // Run glitch
    setTimeout(()=>{
      glitchSettle(glitch,FINAL_TEXT,700,()=>{
        setTimeout(()=>{
          typewriter(tw,TYPEWRITER_TEXT,90,()=>{
            setTimeout(()=>{
              if(cursor)cursor.style.opacity='0';
              if(tagline)tagline.style.opacity='1';
              setTimeout(()=>{if(sh)sh.style.opacity='1';isAnimating=false;},400);
            },600);
          });
        },200);
      });
    },100);
  }

  window.addEventListener('scroll',()=>{
    const ic=document.getElementById('introContent');
    const sh=document.getElementById('scrollHint');
    const scrolled=window.scrollY;
    const fade=Math.max(0,1-scrolled/300);
    if(ic)ic.style.opacity=String(Math.max(fade,0));
    if(sh)sh.style.opacity=String(Math.max(fade*0.7,0));

    // Replay when scrolled back to top
    if(scrolled<20&&hasReplayed){
      hasReplayed=false;
      const ic2=document.getElementById('introContent');
      if(ic2){ic2.style.opacity='1';ic2.style.transform='translateY(0)';}
      runIntroAnimation();
    }
    if(scrolled>100)hasReplayed=true;
  },{passive:true});
})();

(function(){
  const canvas=document.getElementById('bg');
  const ctx=canvas.getContext('2d');
  let W,H,particles,mouse={x:-9999,y:-9999},ripples=[];
  const CFG={count:110,maxDist:130,cursorDist:140,repelDist:120,repelForce:0.18,spring:0.045,baseSpeed:0.35};
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight}
  function Particle(){this.x=Math.random()*W;this.y=Math.random()*H;this.ox=this.x;this.oy=this.y;this.vx=(Math.random()-.5)*CFG.baseSpeed;this.vy=(Math.random()-.5)*CFG.baseSpeed;this.r=Math.random()*1.8+.8;this.alpha=Math.random()*.5+.25}
  function init(){resize();particles=Array.from({length:CFG.count},()=>new Particle())}
  function addRipple(x,y){ripples.push({x,y,r:0,maxR:200,alpha:.6,speed:6})}
  function update(){
    particles.forEach(p=>{
      p.ox+=p.vx;p.oy+=p.vy;
      if(p.ox<0||p.ox>W)p.vx*=-1;if(p.oy<0||p.oy>H)p.vy*=-1;
      const dx=p.x-mouse.x,dy=p.y-mouse.y,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<CFG.repelDist&&dist>0){const force=(CFG.repelDist-dist)/CFG.repelDist*CFG.repelForce;p.x+=(dx/dist)*force*18;p.y+=(dy/dist)*force*18}
      ripples.forEach(rp=>{const rdx=p.x-rp.x,rdy=p.y-rp.y,rd=Math.sqrt(rdx*rdx+rdy*rdy);if(Math.abs(rd-rp.r)<30&&rd>0){const push=(30-Math.abs(rd-rp.r))/30*3.5;p.x+=(rdx/rd)*push;p.y+=(rdy/rd)*push}});
      p.x+=(p.ox-p.x)*CFG.spring;p.y+=(p.oy-p.y)*CFG.spring;
    });
    ripples=ripples.filter(r=>{r.r+=r.speed;r.alpha-=.015;return r.alpha>0&&r.r<r.maxR});
  }
  function draw(){
    ctx.clearRect(0,0,W,H);
    ripples.forEach(r=>{ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.strokeStyle=\`rgba(249,115,22,\${r.alpha*0.4})\`;ctx.lineWidth=1.5;ctx.stroke()});
    for(let i=0;i<particles.length;i++)for(let j=i+1;j<particles.length;j++){const a=particles[i],b=particles[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.sqrt(dx*dx+dy*dy);if(d<CFG.maxDist){const opacity=(1-d/CFG.maxDist)*0.15,mda=Math.sqrt((a.x-mouse.x)**2+(a.y-mouse.y)**2),mdb=Math.sqrt((b.x-mouse.x)**2+(b.y-mouse.y)**2),near=mda<CFG.cursorDist||mdb<CFG.cursorDist;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=\`rgba(249,115,22,\${Math.min(near?opacity*4.5:opacity,.7)})\`;ctx.lineWidth=near?1.2:.5;ctx.stroke()}}
    particles.forEach(p=>{const md=Math.sqrt((p.x-mouse.x)**2+(p.y-mouse.y)**2),near=md<CFG.cursorDist,r=near?p.r*1.8:p.r,alpha=near?Math.min(p.alpha*2.5,.95):p.alpha;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=\`rgba(249,115,22,\${alpha})\`;ctx.fill();if(near){ctx.beginPath();ctx.arc(p.x,p.y,r+3,0,Math.PI*2);ctx.strokeStyle=\`rgba(249,115,22,\${alpha*0.3})\`;ctx.lineWidth=.8;ctx.stroke()}});
  }
  function loop(){update();draw();requestAnimationFrame(loop)}
  window.addEventListener('resize',resize);
  window.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY});
  window.addEventListener('mouseleave',()=>{mouse.x=-9999;mouse.y=-9999});
  document.addEventListener('click',e=>addRipple(e.clientX,e.clientY));
  init();loop();
})();

async function joinWL(e){
  if(e)e.preventDefault();
  const inp=document.getElementById('einp');
  const btn=document.querySelector('.btnp');
  if(!inp.value.trim()||!inp.value.includes('@')){inp.classList.add('err');setTimeout(()=>inp.classList.remove('err'),2000);return}
  btn.textContent='Sending...';btn.style.opacity='.6';btn.disabled=true;
  try{
    const r=await fetch('https://devos-license-server.shiva-deore111.workers.dev/register',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:inp.value.trim().toLowerCase()})
    });
    const data=await r.json();
    if(data.success){
      document.getElementById('eform').style.display='none';
      document.getElementById('wsuc').style.display='block';
    } else {
      btn.textContent='Get Early Access \u2192';btn.style.opacity='1';btn.disabled=false;
      inp.style.borderColor='rgba(239,68,68,.5)';setTimeout(()=>inp.style.borderColor='',2000);
    }
  } catch {
    document.getElementById('eform').style.display='none';
    document.getElementById('wsuc').style.display='block';
  }
}
document.getElementById('einp').addEventListener('keydown',e=>{if(e.key==='Enter')joinWL(null)});

(function(){
  const SESSIONS=[
    [{type:'cmd',text:'aiden "clean up my Downloads folder \u2014 keep the last 30 days"'},{type:'out',cls:'ac',text:'\u25B8 Planning task...',delay:380},{type:'out',cls:'',text:'  Safety Gate \u2192 approval requested before deleting',delay:300},{type:'out',cls:'ok',text:'  Scanning Downloads: 847 files found',delay:480},{type:'out',cls:'ok',text:'  Identified: 612 files older than 30 days (38.2 GB)',delay:700},{type:'out',cls:'ok',text:'  Approval received \u2192 moving to Trash',delay:600},{type:'out',cls:'ok',text:'  \u2713 612 files moved \xB7 38.2 GB freed',delay:850},{type:'out',cls:'am',text:'  \u25CF Disk: 78% \u2192 52% \xB7 Task complete',delay:350},{type:'gap',delay:500}],
    [{type:'cmd',text:'aiden "research best standing desk options under \u20B920,000"'},{type:'out',cls:'ac',text:'\u25B8 Starting deep research...',delay:300},{type:'out',cls:'ok',text:'  Pass 1: searching for standing desk reviews India',delay:500},{type:'out',cls:'ok',text:'  Pass 2: searching for ergonomic desk comparisons 2026',delay:600},{type:'out',cls:'ok',text:'  Gap detected: no height range data \u2014 searching again',delay:700},{type:'out',cls:'ok',text:'  Synthesising 8 sources into report...',delay:500},{type:'out',cls:'ok',text:'  Saving report to Desktop/standing_desks.md',delay:400},{type:'out',cls:'am',text:'  \u25CF Report saved \xB7 3 top picks identified under \u20B920,000',delay:350},{type:'gap',delay:500}],
    [{type:'cmd',text:'aiden "build a Python script to rename all photos by date taken"'},{type:'out',cls:'ac',text:'\u25B8 Planning...',delay:280},{type:'out',cls:'ok',text:'  Writing script: rename_photos.py',delay:500},{type:'out',cls:'ok',text:'  Testing on 3 sample files...',delay:600},{type:'out',cls:'ok',text:'  \u2713 All 3 renamed correctly \xB7 verified',delay:500},{type:'out',cls:'ok',text:'  Script saved to Desktop',delay:350},{type:'out',cls:'am',text:'  \u25CF Ready to run on your full photo library',delay:300},{type:'gap',delay:500}],
    [{type:'cmd',text:'aiden "monitor my disk every hour and notify me when below 10GB free"'},{type:'out',cls:'ac',text:'\u25B8 Setting up scheduled task...',delay:400},{type:'out',cls:'ok',text:'  Task created: disk monitor \xB7 every hour',delay:500},{type:'out',cls:'ok',text:'  Running in background \xB7 no window needed',delay:400},{type:'out',cls:'am',text:'  \u25CF Active. You will be notified at threshold.',delay:350},{type:'gap',delay:500}],
  ];
  const body=document.getElementById('termBody');
  if(!body)return;
  let si=0,cur=null;
  function mkCur(){const c=document.createElement('span');c.style.cssText='display:inline-block;width:7px;height:13px;background:var(--orange);margin-left:1px;vertical-align:middle;animation:blink .75s infinite';return c}
  function line(cls,html){const d=document.createElement('div');d.className=cls;d.innerHTML=html;body.appendChild(d);body.scrollTop=9999;return d}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
  async function type(el,text){el.textContent='';if(cur)el.appendChild(cur);for(let i=0;i<text.length;i++){const t=document.createTextNode(text[i]);el.insertBefore(t,cur);body.scrollTop=9999;await sleep(36+Math.random()*20)}}
  async function run(steps){for(const s of steps){if(s.type==='gap'){line('tgap','');await sleep(s.delay||350);continue}if(s.type==='cmd'){const row=line('tl','');const ps=document.createElement('span');ps.className='tps';ps.textContent='$ ';const cmd=document.createElement('span');cmd.className='tcmd';cur=mkCur();row.appendChild(ps);row.appendChild(cmd);await sleep(280);await type(cmd,s.text);await sleep(130);if(cur&&cur.parentNode)cur.parentNode.removeChild(cur);cur=null;await sleep(240)}else{await sleep(s.delay||300);const d=line('tout'+(s.cls?' '+s.cls:''),'');d.textContent=s.text;body.scrollTop=9999}}}
  async function loop(){while(true){await run(SESSIONS[si%SESSIONS.length]);si++;await sleep(400);if(si%SESSIONS.length===0){await sleep(1600);body.style.transition='opacity .4s';body.style.opacity='0';await sleep(420);body.innerHTML='';body.style.opacity='1';await sleep(350)}}}
  setTimeout(loop,800);
})();

(function(){
  const CONVOS=[
    {user:'What can you see on my machine right now?',logs:[{t:'00:01',ic:'\u25B8',txt:'<span class="hi">Checking system</span> \u2192 scanning your machine'},{t:'00:02',ic:'\u25B8',txt:'<span class="ac">Open windows</span> \u2192 VS Code, Chrome (12 tabs), Spotify'},{t:'00:03',ic:'\u25B8',txt:'<span class="hi">System</span> \u2192 6.2GB RAM free \xB7 disk 78% full'},{t:'00:04',ic:'\u25B8',txt:'<span class="ok">Context ready</span> \xB7 responding with awareness'}],reply:'I can see you have VS Code open with a project, 12 Chrome tabs running, and Spotify playing. Your disk is 78% full and you have 6.2GB RAM free. Chrome is using most of it. Want me to do anything about that?'},
    {user:'Research AI trends in India for 2026 and save a report',logs:[{t:'00:01',ic:'\u25B8',txt:'<span class="hi">Research</span> \u2192 starting multi-pass search'},{t:'00:02',ic:'\u25B8',txt:'<span class="ac">Web search</span> \u2192 fetching 4 sources'},{t:'00:03',ic:'\u25B8',txt:'<span class="hi">Gap detected</span> \u2192 searching for funding data'},{t:'00:04',ic:'\u25B8',txt:'<span class="ok">Saving</span> \u2192 ai_trends_india_2026.md'},{t:'00:05',ic:'\u25B8',txt:'<span class="ok">Done</span> \xB7 3 passes \xB7 14,200 chars'}],reply:'Report saved to your Desktop as ai_trends_india_2026.md. Covered funding landscape, key players, government initiatives, and emerging use cases. 3 research passes \u2014 nothing major was missing.'},
    {user:'Remind me every day at 9am to check my email',logs:[{t:'00:01',ic:'\u25B8',txt:'<span class="hi">Scheduler</span> \u2192 creating daily task'},{t:'00:02',ic:'\u25B8',txt:'<span class="ac">Schedule</span> \u2192 every day at 9:00am'},{t:'00:03',ic:'\u25B8',txt:'<span class="ok">Task saved</span> \xB7 running in background'},{t:'00:04',ic:'\u25B8',txt:'<span class="ok">Active</span> \xB7 no window needed'}],reply:"Done. I'll send you a desktop notification every morning at 9am. Runs in the background \u2014 you don't need to keep anything open."},
  ];
  const chatMessages=document.getElementById('chatMessages'),chatInputText=document.getElementById('chatInputText'),logBody=document.getElementById('logBody');
  if(!chatMessages||!chatInputText||!logBody)return;
  let ci=0;
  function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
  async function typeInput(text){chatInputText.textContent='';for(let i=0;i<text.length;i++){chatInputText.textContent+=text[i];await sleep(36+Math.random()*22)}await sleep(300)}
  function addMsg(who,text){const div=document.createElement('div');div.className='msg '+who;const lbl=document.createElement('div');lbl.className='msg-lbl';lbl.textContent=who==='user'?'You':'Aiden';const bubble=document.createElement('div');bubble.className='msg-bubble';bubble.style.whiteSpace='pre-wrap';bubble.textContent=text;div.appendChild(lbl);div.appendChild(bubble);chatMessages.appendChild(div);chatMessages.scrollTop=9999;return bubble}
  function addTyping(){const div=document.createElement('div');div.className='msg ai';div.id='typingInd';const lbl=document.createElement('div');lbl.className='msg-lbl';lbl.textContent='Aiden';const bubble=document.createElement('div');bubble.className='msg-bubble';bubble.innerHTML='<span style="font-family:var(--mono);font-size:11px;color:var(--muted)">working locally<span id="tDots"></span></span>';div.appendChild(lbl);div.appendChild(bubble);chatMessages.appendChild(div);chatMessages.scrollTop=9999;let d=0;const iv=setInterval(()=>{const el=document.getElementById('tDots');if(el)el.textContent='.'.repeat((d++%3)+1)},400);div._clear=()=>clearInterval(iv);return div}
  async function addLog(entry,delay){await sleep(delay);const el=document.createElement('div');el.className='log-entry';el.innerHTML=\`<span class="log-time">\${entry.t}</span><span class="log-ic">\${entry.ic}</span><div class="log-txt">\${entry.txt}</div>\`;logBody.appendChild(el);logBody.scrollTop=9999;requestAnimationFrame(()=>setTimeout(()=>el.classList.add('show'),20))}
  async function runConvo(c){await typeInput(c.user);chatInputText.textContent='';addMsg('user',c.user);await sleep(280);const ind=addTyping();for(let i=0;i<c.logs.length;i++)await addLog(c.logs[i],i===0?280:560);await sleep(750);if(ind._clear)ind._clear();ind.remove();addMsg('ai',c.reply);await sleep(2100)}
  async function loop(){while(true){await runConvo(CONVOS[ci%CONVOS.length]);ci++;if(ci%CONVOS.length===0){await sleep(1300);chatMessages.style.transition='opacity .4s';logBody.style.transition='opacity .4s';chatMessages.style.opacity='0';logBody.style.opacity='0';await sleep(420);chatMessages.innerHTML='';logBody.innerHTML='';chatMessages.style.opacity='1';logBody.style.opacity='1';await sleep(450)}}}
  setTimeout(loop,1100);
})();

(function(){
  const ROWS=[
    {
      feature:'Privacy & Data',
      desc:'Where your data lives',
      aiden:'100% on your machine. Nothing leaves. Ever.',
      aidenOk:true,
      cloud:'Processed on external servers. May be used for training.',
      cloudOk:false,
    },
    {
      feature:'Computer Control',
      desc:'Can it touch your machine',
      aiden:'Sees your screen, clicks, types, moves files \u2014 full control.',
      aidenOk:true,
      cloud:'Lives in a browser tab. Cannot touch your computer.',
      cloudOk:false,
    },
    {
      feature:'Memory',
      desc:'Remembers you between sessions',
      aiden:'Persistent across all sessions forever. Knows your patterns.',
      aidenOk:true,
      cloud:'Forgets you when the tab closes. Starts fresh every time.',
      cloudOk:false,
    },
    {
      feature:'Works Offline',
      desc:'No internet needed',
      aiden:'Local AI models \u2014 works with zero internet connection.',
      aidenOk:true,
      cloud:'Completely unusable without internet.',
      cloudOk:false,
    },
    {
      feature:'File Access',
      desc:'Reads and writes your files',
      aiden:'Full filesystem access. Creates, edits, organises anything.',
      aidenOk:true,
      cloud:'Cannot access your files. Copy-paste only.',
      cloudOk:false,
    },
    {
      feature:'Runs in Background',
      desc:'Works while you are away',
      aiden:'Background service \u2014 scheduled tasks, monitoring, automations.',
      aidenOk:true,
      cloud:'Only active when you have a tab open.',
      cloudOk:false,
    },
    {
      feature:'Scheduled Tasks',
      desc:'Automates things on a timer',
      aiden:'Natural language scheduling \u2014 "every Monday at 9am".',
      aidenOk:true,
      cloud:'No scheduling. No background execution.',
      cloudOk:false,
    },
    {
      feature:'Learns From Your Files',
      desc:'Upload your documents',
      aiden:'Reads your PDFs, books, notes \u2014 uses them in every task.',
      aidenOk:true,
      cloud:'No persistent knowledge base. No file learning.',
      cloudOk:false,
    },
  ];

  const container=document.getElementById('compareRows');
  if(!container)return;

  ROWS.forEach((row,i)=>{
    const el=document.createElement('div');
    el.style.cssText=\`display:grid;grid-template-columns:1fr 180px 180px;border-bottom:\${i<ROWS.length-1?'1px solid rgba(249,115,22,0.08)':'none'};transition:background .15s;\`;
    el.onmouseenter=()=>el.style.background='rgba(249,115,22,0.04)';
    el.onmouseleave=()=>el.style.background='';

    el.innerHTML=\`
      <div style="padding:20px 28px">
        <div style="font-size:13px;font-weight:600;margin-bottom:3px;letter-spacing:-.01em;color:var(--text)">\${row.feature}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--muted)">\${row.desc}</div>
      </div>
      <div style="padding:20px 28px;border-left:1px solid rgba(249,115,22,0.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);display:flex;align-items:center;justify-content:center;font-size:13px;color:#22c55e;font-weight:700">\${row.aidenOk?'\u2713':'\u2717'}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted2);line-height:1.6">\${row.aiden}</div>
      </div>
      <div style="padding:20px 28px;border-left:1px solid rgba(249,115,22,0.1);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center">
        <div style="width:28px;height:28px;border-radius:50%;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);display:flex;align-items:center;justify-content:center;font-size:13px;color:#f87171;font-weight:700">\${row.cloudOk?'\u2713':'\u2717'}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);line-height:1.6">\${row.cloud}</div>
      </div>
    \`;
    container.appendChild(el);
  });
})();

let selectedCat='tools',sortMode='votes';
function selectCat(btn,cat){selectedCat=cat;document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
function getReqs(){try{return JSON.parse(localStorage.getItem('devos_v2_reqs')||'[]')}catch{return[]}}
function saveReqs(r){try{localStorage.setItem('devos_v2_reqs',JSON.stringify(r))}catch{}}
function getVoted(){try{return JSON.parse(localStorage.getItem('devos_v2_voted')||'[]')}catch{return[]}}
function saveVoted(v){try{localStorage.setItem('devos_v2_voted',JSON.stringify(v))}catch{}}
function timeAgo(ts){const s=Math.floor((Date.now()-ts)/1000);if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
function submitReq(){const txt=document.getElementById('frText').value.trim(),hint=document.getElementById('frHint');if(!txt||txt.length<10){hint.style.color='#f87171';hint.textContent='Please add more detail.';setTimeout(()=>{hint.style.color='';hint.textContent='Select a category and describe your idea.'},2500);return}const reqs=getReqs();reqs.push({id:Date.now(),text:txt,cat:selectedCat,votes:1,ts:Date.now()});saveReqs(reqs);const voted=getVoted();voted.push(reqs[reqs.length-1].id);saveVoted(voted);document.getElementById('frText').value='';hint.style.color='var(--green)';hint.textContent='\u2713 Submitted! Thanks.';setTimeout(()=>{hint.style.color='';hint.textContent='Select a category and describe your idea.'},3000);renderFeed()}
function vote(id){const voted=getVoted(),reqs=getReqs(),idx=reqs.findIndex(r=>r.id===id);if(idx===-1)return;if(voted.includes(id)){reqs[idx].votes=Math.max(0,reqs[idx].votes-1);saveVoted(voted.filter(v=>v!==id))}else{reqs[idx].votes++;voted.push(id);saveVoted(voted)}saveReqs(reqs);renderFeed()}
function sortBy(mode,btn){sortMode=mode;document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderFeed()}
function renderFeed(){const reqs=getReqs(),voted=getVoted(),list=document.getElementById('frList'),empty=document.getElementById('frEmpty'),countEl=document.getElementById('reqCount');countEl.textContent=reqs.length+' request'+(reqs.length!==1?'s':'');if(!reqs.length){list.innerHTML='';if(!list.contains(empty))list.appendChild(empty);return}empty.remove();let sorted=[...reqs];if(sortMode==='votes')sorted.sort((a,b)=>b.votes-a.votes);else sorted.sort((a,b)=>b.ts-a.ts);list.innerHTML=sorted.map(r=>\`<div class="fr-item"><div class="fr-vote"><button class="vbtn\${voted.includes(r.id)?' voted':''}" onclick="vote(\${r.id})" title="\${voted.includes(r.id)?'Remove vote':'Upvote'}">\u25B2</button><span class="vcount">\${r.votes}</span></div><div class="fr-content"><div class="fr-meta"><span class="cat-pill">\${r.cat}</span><span class="fr-time">\${timeAgo(r.ts)}</span></div><div class="fr-text">\${r.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div></div>\`).join('')}
(function seedExamples(){if(getReqs().length>0)return;const seeds=[{id:3001,text:'Notion integration \u2014 read and write directly to my pages',cat:'tools',votes:18,ts:Date.now()-86400000*3},{id:3002,text:'Voice control \u2014 say a goal out loud and Aiden executes it',cat:'voice',votes:15,ts:Date.now()-86400000*2},{id:3003,text:'Android app to send goals from my phone',cat:'channels',votes:13,ts:Date.now()-86400000},{id:3004,text:'Auto-organise my Downloads folder every week',cat:'automation',votes:11,ts:Date.now()-3600000*8},{id:3005,text:'Calendar integration \u2014 check my schedule before suggesting times',cat:'tools',votes:9,ts:Date.now()-3600000*3},{id:3006,text:'WhatsApp automation \u2014 draft and send replies from a template',cat:'automation',votes:7,ts:Date.now()-3600000}];saveReqs(seeds);saveVoted([])})();
renderFeed();
<\/script>
</body>
</html>
`;
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Version": "aiden-v2-final"
      }
    });
  }
};
export {
  landing_default as default
};
//# sourceMappingURL=landing.js.map
