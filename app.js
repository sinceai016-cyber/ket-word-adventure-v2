(()=>{
  'use strict';
  const WORDS=window.KET_WORDS||[];
  const KEY='ket-word-planet-v1';
  const INTERVALS=[0,1,3,7,14,30,60];
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const today=()=>new Date().toLocaleDateString('en-CA');
  const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+n);return d.toLocaleDateString('en-CA')};
  const dayDistance=(from,to)=>Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/86400000);
  const formatDate=date=>new Date(`${date}T12:00:00`).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
  const fresh=()=>({version:1,settings:{goal:10,autoSpeak:true},words:{},stars:0,rewarded:{},days:{}});
  function normalize(raw){
    const base=fresh(),source=raw&&typeof raw==='object'?raw:{};
    return {...base,...source,settings:{...base.settings,...(source.settings||{})},words:source.words&&typeof source.words==='object'?source.words:{},rewarded:source.rewarded&&typeof source.rewarded==='object'?source.rewarded:{},days:source.days&&typeof source.days==='object'?source.days:{},stars:Number.isFinite(Number(source.stars))?Number(source.stars):0};
  }
  let data=load(),session=[],sessionType='new',sessionIndex=0,sessionReward=0,currentFilter='all';

  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{return fresh()}}
  function save(){localStorage.setItem(KEY,JSON.stringify(data))}
  function dayStats(){return data.days[today()]||(data.days[today()]={new:0,review:0,stars:0})}
  function getState(id){return data.words[id]}
  function learned(){return WORDS.filter(w=>getState(w.id))}
  function mastered(){return learned().filter(w=>getState(w.id).stage>=6)}
  function due(){const t=today();return learned().filter(w=>getState(w.id).due<=t&&getState(w.id).lastReviewed!==t)}
  function availableNew(){const remaining=Math.max(0,data.settings.goal-dayStats().new);return WORDS.filter(w=>!getState(w.id)).slice(0,remaining)}
  function showView(id){$$('.view').forEach(v=>v.classList.remove('active'));$(`#${id}`).classList.add('active');scrollTo({top:0,behavior:'smooth'})}
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1900)}

  function renderHome(){
    const d=dayStats(),newWords=availableNew(),reviews=due(),known=learned().length,done=mastered().length;
    $('#totalStars').textContent=data.stars;$('#todayNew').textContent=d.new;$('#todayReview').textContent=d.review;
    $('#dailyGoalLabel').textContent=data.settings.goal;$('#newCountBadge').textContent=newWords.length?`${newWords.length} 个新词`:'今日已完成';
    $('#reviewCountBadge').textContent=reviews.length?`${reviews.length} 个待复习`:'今天无待复习';
    $('#startButton').disabled=!newWords.length;$('#reviewButton').disabled=!reviews.length;$('#reviewButton').classList.toggle('ready',reviews.length>0);
    $('#startButton').style.opacity=newWords.length?1:.6;$('#reviewButton').style.opacity=reviews.length?1:.7;
    $('#newRing').style.setProperty('--p',Math.min(100,Math.round(d.new/data.settings.goal*100)));
    $('#streakDays').textContent=streak();$('#masteryText').textContent=`已掌握 ${done} 个 · 已遇见 ${known} 个`;
    const p=Math.min(100,Math.round(known/WORDS.length*100));$('#masteryBar').style.width=`${p}%`;$('#rocket').style.left=`${p}%`;
    $('#heroMessage').textContent=reviews.length?`有 ${reviews.length} 个老朋友在等你复习，先和它们打个招呼吧！`:d.new>=data.settings.goal?'今天任务完成啦，明天继续探索新星球！':'每天认识一点点，单词星球会越来越亮。';
    renderBadges(known,done);
  }
  function streak(){
    const dates=Object.keys(data.days).filter(k=>(data.days[k].new||data.days[k].review)).sort().reverse();if(!dates.length)return 0;
    let d=new Date(`${today()}T12:00:00`),count=0;if(dates[0]!==today()){d.setDate(d.getDate()-1);if(dates[0]!==d.toLocaleDateString('en-CA'))return 0}
    for(const date of dates){if(date===d.toLocaleDateString('en-CA')){count++;d.setDate(d.getDate()-1)}else if(date<d.toLocaleDateString('en-CA'))break}return count;
  }
  function renderBadges(known,done){
    const items=[['🌱','初次启航','认识10个词',known>=10],['🌙','月球漫步','认识50个词',known>=50],['🔥','坚持之火','连续学习7天',streak()>=7],['👑','记忆之王','掌握50个词',done>=50]];
    $('#badges').innerHTML=items.map(x=>`<div class="badge ${x[3]?'unlocked':''}"><span>${x[0]}</span><b>${x[1]}</b><small>${x[3]?'已点亮':x[2]}</small></div>`).join('');
  }

  function start(type){
    sessionType=type;session=type==='review'?due():availableNew();if(!session.length){toast(type==='review'?'今天没有待复习单词':'今天的新词已经学完啦');return}
    sessionIndex=0;sessionReward=0;$('#modePill').textContent=type==='review'?'唤醒记忆':'认识新单词';showView('sessionView');renderCard();
  }
  function renderCard(){
    const w=session[sessionIndex];if(!w){finishSession();return}
    $('#sessionStep').textContent=`${sessionIndex+1} / ${session.length}`;$('#sessionBar').style.width=`${sessionIndex/session.length*100}%`;
    $('#cardPlanet').textContent=w.emoji;$('#wordPart').textContent=w.part;$('#wordText').textContent=w.word;$('#phoneticText').textContent=w.ipa;
    $('#wordZh').textContent=w.zh;$('#wordExample').textContent=w.example;$('#exampleZh').textContent=w.exampleZh;
    $('#revealArea').classList.remove('hidden');$('#answerArea').classList.add('hidden');$('#answerButtons').classList.add('hidden');
    $('#wordCard').animate?.([{transform:'translateX(16px)',opacity:.4},{transform:'translateX(0)',opacity:1}],{duration:280,easing:'ease-out'});
    if(data.settings.autoSpeak)setTimeout(()=>speak(w.word),300);
  }
  function reveal(){$('#revealArea').classList.add('hidden');$('#answerArea').classList.remove('hidden');$('#answerButtons').classList.remove('hidden')}
  function answer(result,target){
    const w=session[sessionIndex],t=today(),wasNew=!getState(w.id),state=getState(w.id)||{stage:0,seen:0,correct:0};
    state.seen++;state.lastReviewed=t;
    if(wasNew){state.learnedOn=t;dayStats().new++}else dayStats().review++;
    if(result==='good'){state.stage=Math.min(6,(state.stage||0)+1);state.correct++;state.due=addDays(t,INTERVALS[state.stage]||60)}
    if(result==='hard'){state.stage=Math.max(1,state.stage||0);state.due=addDays(t,1)}
    if(result==='again'){state.stage=0;state.due=t}
    data.words[w.id]=state;
    const rewardKey=`${t}-${w.id}`;if(!data.rewarded[rewardKey]){data.rewarded[rewardKey]=1;data.stars++;dayStats().stars++;sessionReward++}
    save();$('#totalStars').textContent=data.stars;starBurst(target);sessionIndex++;setTimeout(renderCard,260);
  }
  function starBurst(target){
    const box=target?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:1,height:1};
    for(let i=0;i<8;i++){const s=document.createElement('i');s.textContent='⭐';s.style.cssText=`position:fixed;z-index:20;left:${box.left+box.width/2}px;top:${box.top}px;font-style:normal;pointer-events:none;font-size:${12+Math.random()*12}px;--x:${(Math.random()-.5)*150}px;--y:${-40-Math.random()*100}px`;document.body.appendChild(s);s.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:'translate(var(--x),var(--y)) scale(1.1)',opacity:0}],{duration:700,easing:'ease-out'}).onfinish=()=>s.remove()}
  }
  function finishSession(){
    $('#sessionBar').style.width='100%';$('#rewardStars').textContent=sessionReward;$('#completeSummary').textContent=`完成了 ${session.length} 个${sessionType==='review'?'复习':'新单词'}，每颗星都很闪亮！`;showView('completeView')
  }
  function speak(text){if(!('speechSynthesis'in window)){toast('这台设备暂不支持朗读');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=.78;speechSynthesis.speak(u)}

  function renderWords(){
    const q=$('#wordSearch').value.trim().toLowerCase();let list=WORDS.filter(w=>w.word.includes(q)||w.zh.includes(q));
    if(currentFilter==='learning')list=list.filter(w=>getState(w.id)&&getState(w.id).stage<6);
    if(currentFilter==='mastered')list=list.filter(w=>getState(w.id)?.stage>=6);
    $('#wordList').innerHTML=list.map(w=>{const s=getState(w.id),kind=!s?'new':s.stage>=6?'mastered':'learning',label=!s?'未遇见':s.stage>=6?'已掌握':`记忆等级 ${s.stage}`;return `<article class="word-row ${kind}"><span class="state">${!s?'🌑':s.stage>=6?'🌟':'🌱'}</span><div><b>${w.word}</b><small>${w.zh} · ${label}</small></div><button aria-label="朗读 ${w.word}" data-speak="${w.word}">🔊</button></article>`}).join('')||'<p>这里还没有单词。</p>';
  }
  function estimatePlan(goal){
    const known=learned(),remaining=Math.max(0,WORDS.length-known.length),stats=dayStats();
    const todayCapacity=Math.max(0,goal-stats.new);
    let newStudyDays=0,lastNewOffset=0;
    if(remaining>0){
      if(todayCapacity>0){newStudyDays=1+Math.ceil(Math.max(0,remaining-todayCapacity)/goal);lastNewOffset=Math.ceil(Math.max(0,remaining-todayCapacity)/goal)}
      else{newStudyDays=Math.ceil(remaining/goal);lastNewOffset=newStudyDays}
    }
    let finalReviewOffset=0;
    for(const word of known){
      const state=getState(word.id)||{},stage=Math.max(0,Math.min(6,state.stage||0));
      const dueOffset=Math.max(0,dayDistance(today(),state.due||today()));
      const remainingIntervals=INTERVALS.slice(stage+1).reduce((sum,days)=>sum+days,0);
      finalReviewOffset=Math.max(finalReviewOffset,dueOffset+remainingIntervals);
    }
    if(remaining>0)finalReviewOffset=Math.max(finalReviewOffset,lastNewOffset+INTERVALS.slice(1).reduce((sum,days)=>sum+days,0));
    return {known:known.length,remaining,newStudyDays,lastNewOffset,finalReviewOffset};
  }
  function updateStudyEstimate(goal){
    const plan=estimatePlan(Number(goal)||10);
    $('#estimateProgress').textContent=`已学习 ${plan.known} / ${WORDS.length}，还剩 ${plan.remaining} 项`;
    $('#newWordsDays').textContent=plan.remaining?`约 ${plan.newStudyDays} 天`:'已经学完';
    $('#newWordsDate').textContent=plan.remaining?`预计 ${formatDate(addDays(today(),plan.lastNewOffset))}`:'继续按时复习';
    $('#reviewDays').textContent=plan.finalReviewOffset?`约 ${plan.finalReviewOffset} 天`:'已经完成';
    $('#reviewDate').textContent=plan.finalReviewOffset?`预计 ${formatDate(addDays(today(),plan.finalReviewOffset))}`:'太棒了！';
  }
  function exportProgress(){
    save();
    const payload={app:'ket-word-planet',format:1,exportedAt:new Date().toISOString(),data};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`KET学习记录-${today()}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('学习记录已导出');
  }
  async function importProgress(file){
    try{
      const payload=JSON.parse(await file.text()),source=payload?.app==='ket-word-planet'?payload.data:payload;
      if(!source||typeof source!=='object'||!source.words||!source.settings)throw new Error('invalid');
      if(!confirm('导入后将替换这台设备当前的学习记录，确定继续吗？'))return;
      data=normalize(source);save();$('#dailyGoal').value=data.settings.goal;$('#goalValue').textContent=data.settings.goal;$('#autoSpeak').checked=data.settings.autoSpeak;updateStudyEstimate(data.settings.goal);renderHome();toast('学习记录已恢复');
    }catch{alert('这个文件不是有效的KET学习记录，请重新选择。')}
    finally{$('#importFile').value=''}
  }
  function openSettings(){$('#dailyGoal').value=data.settings.goal;$('#goalValue').textContent=data.settings.goal;$('#autoSpeak').checked=data.settings.autoSpeak;updateStudyEstimate(data.settings.goal);$('#settingsDialog').showModal()}

  $('#startButton').addEventListener('click',()=>start('new'));$('#reviewButton').addEventListener('click',()=>start('review'));
  $('#revealButton').addEventListener('click',reveal);$('#speakButton').addEventListener('click',()=>speak(session[sessionIndex].word));
  $$('.answer-btn').forEach(b=>b.addEventListener('click',e=>answer(e.currentTarget.dataset.answer,e.currentTarget)));
  $('#exitSession').addEventListener('click',()=>{if(confirm('要先回到首页吗？已经完成的单词会保留。')){renderHome();showView('homeView')}});
  $('#backHome').addEventListener('click',()=>{renderHome();showView('homeView')});
  $('#allWordsButton').addEventListener('click',()=>{renderWords();showView('wordsView')});$('#wordsBack').addEventListener('click',()=>{renderHome();showView('homeView')});
  $('#wordSearch').addEventListener('input',renderWords);$('.filter-row').addEventListener('click',e=>{if(!e.target.matches('.filter'))return;$$('.filter').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');currentFilter=e.target.dataset.filter;renderWords()});
  $('#wordList').addEventListener('click',e=>{const b=e.target.closest('[data-speak]');if(b)speak(b.dataset.speak)});
  $('#settingsButton').addEventListener('click',openSettings);$('#dailyGoal').addEventListener('input',e=>{$('#goalValue').textContent=e.target.value;updateStudyEstimate(e.target.value)});
  $('#settingsDialog').addEventListener('close',()=>{data.settings.goal=Number($('#dailyGoal').value);data.settings.autoSpeak=$('#autoSpeak').checked;save();renderHome()});
  $('#exportButton').addEventListener('click',exportProgress);$('#importButton').addEventListener('click',()=>$('#importFile').click());$('#importFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importProgress(file)});
  $('#resetButton').addEventListener('click',()=>{if(confirm('确定清空这台设备上的全部学习记录吗？这一步不能恢复。')){data=fresh();save();$('#settingsDialog').close();renderHome();toast('学习记录已清空')}});
  $('#starsChip').addEventListener('click',()=>toast(`你已经收集了 ${data.stars} 颗星星！`));
  window.addEventListener('hashchange',()=>{if(location.hash==='#home'){renderHome();showView('homeView')}});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js?v=12',{updateViaCache:'none'}).catch(()=>{});
  renderHome();
})();
