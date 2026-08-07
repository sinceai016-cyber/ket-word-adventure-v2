(()=>{
  'use strict';
  const WORDS=window.KET_WORDS||[];
  const KEY='ket-word-planet-v1';
  const TEST_KEY='ket-word-planet-test-v1';
  const TEST_META_KEY='ket-word-planet-test-meta-v1';
  const {MILESTONES,addDays,dayDistance,scheduleAnswer,finalReviewDate}=window.KET_SCHEDULER;
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const realToday=()=>new Date().toLocaleDateString('en-CA');
  const formatDate=date=>new Date(`${date}T12:00:00`).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
  const fresh=()=>({version:1,settings:{goal:10,autoSpeak:true,simpleMode:false},words:{},stars:0,rewarded:{},days:{}});
  function normalize(raw){
    const base=fresh(),source=raw&&typeof raw==='object'?raw:{};
    return {...base,...source,settings:{...base.settings,...(source.settings||{})},words:source.words&&typeof source.words==='object'?source.words:{},rewarded:source.rewarded&&typeof source.rewarded==='object'?source.rewarded:{},days:source.days&&typeof source.days==='object'?source.days:{},stars:Number.isFinite(Number(source.stars))?Number(source.stars):0};
  }
  function loadTestMeta(){
    try{
      const raw=JSON.parse(localStorage.getItem(TEST_META_KEY)||'{}');
      return {active:!!raw.active,startedOn:raw.startedOn||realToday(),simulatedDate:raw.simulatedDate||realToday()};
    }catch{return {active:false,startedOn:realToday(),simulatedDate:realToday()}}
  }
  let testMeta=loadTestMeta();
  const today=()=>testMeta.active?testMeta.simulatedDate:realToday();
  let data=load(),session=[],sessionType='new',sessionIndex=0,sessionReward=0,taskCompleted=0,currentFilter='all',skipSettingsClose=false;
  let recallMode='meaning',spellingAttempts=0,usedAudioHint=false,spellingResult='again',simpleAnswerResult='good';

  function activeKey(){return testMeta.active?TEST_KEY:KEY}
  function load(){try{return normalize(JSON.parse(localStorage.getItem(activeKey())||'{}'))}catch{return fresh()}}
  function save(){localStorage.setItem(activeKey(),JSON.stringify(data))}
  function saveTestMeta(){localStorage.setItem(TEST_META_KEY,JSON.stringify(testMeta))}
  function dayStats(){return data.days[today()]||(data.days[today()]={new:0,review:0,stars:0})}
  function getState(id){return data.words[id]}
  function learned(){return WORDS.filter(w=>getState(w.id))}
  function mastered(){return learned().filter(w=>getState(w.id).completed||getState(w.id).stage>=7)}
  function due(){const t=today();return learned().filter(w=>{const s=getState(w.id);return !s.completed&&s.due&&s.due<=t&&s.lastReviewed!==t})}
  function availableNew(){const remaining=Math.max(0,data.settings.goal-dayStats().new);return WORDS.filter(w=>!getState(w.id)).slice(0,remaining)}
  function showView(id){$$('.view').forEach(v=>v.classList.remove('active'));$(`#${id}`).classList.add('active');document.body.classList.toggle('session-active',id==='sessionView');scrollTo({top:0,behavior:'smooth'})}
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),1900)}

  function renderHome(){
    const d=dayStats(),newWords=availableNew(),reviews=due(),known=learned().length,done=mastered().length;
    $('#testModeBar').hidden=!testMeta.active;
    $('#testModeDate').textContent=testMeta.active?formatDate(today()):'';
    document.body.classList.toggle('test-mode',testMeta.active);
    document.body.classList.toggle('simple-mode',data.settings.simpleMode);
    $('#modeSwitchText').textContent=data.settings.simpleMode?'简单模式':'经典模式';
    $('#modeSwitchButton').classList.toggle('simple-active',data.settings.simpleMode);
    $('#totalStars').textContent=data.stars;$('#todayNew').textContent=d.new;$('#todayReviewDone').textContent=d.review;$('#todayReviewRemaining').textContent=reviews.length;
    $('#dailyGoalLabel').textContent=data.settings.goal;$('#newCountBadge').textContent=newWords.length?`${newWords.length} 个新词`:'今日已完成';
    $('#reviewCountBadge').textContent=reviews.length?`${d.review} 已复习 / ${reviews.length} 待复习`:d.review?`${d.review} 已复习 / 0 待复习`:'今天无待复习';
    $('#startButton').disabled=!newWords.length;$('#reviewButton').disabled=!reviews.length;$('#reviewButton').classList.toggle('ready',reviews.length>0);
    $('#startButton').style.opacity=newWords.length?1:.6;$('#reviewButton').style.opacity=reviews.length?1:.7;
    $('#newRing').style.setProperty('--p',Math.min(100,Math.round(d.new/data.settings.goal*100)));
    $('#streakDays').textContent=streak();$('#masteryText').textContent=`已掌握 ${done} 个 · 已遇见 ${known} 个`;
    const p=Math.min(100,Math.round(known/WORDS.length*100));$('#masteryBar').style.width=`${p}%`;$('#rocket').style.left=`${p}%`;
    $('#heroMessage').textContent=reviews.length?`有 ${reviews.length} 个老朋友在等你复习，先和它们打个招呼吧！`:d.new>=data.settings.goal?'今天任务完成啦，明天继续探索新星球！':'每天认识一点点，单词星球会越来越亮。';
    const simpleDone=d.review+d.new,simpleRemaining=reviews.length+newWords.length,simpleTotal=simpleDone+simpleRemaining;
    const simplePercent=simpleTotal?Math.round(simpleDone/simpleTotal*100):100;
    $('#simpleTaskCount').textContent=`${simpleDone} / ${simpleTotal}`;
    $('#simpleProgressBar').style.width=`${simplePercent}%`;
    $('#simpleTaskDetail').textContent=`复习 ${d.review}/${d.review+reviews.length} · 新学 ${d.new}/${data.settings.goal}`;
    $('#simpleStartText').textContent=simpleRemaining?(simpleDone?'继续今天任务':'开始今天任务'):'今天任务完成';
    $('#simpleStartButton').disabled=!simpleRemaining;
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

  function start(type,continueTask=false){
    sessionType=type;session=type==='review'?due():availableNew();if(!session.length){toast(type==='review'?'今天没有待复习单词':'今天的新词已经学完啦');return}
    sessionIndex=0;if(!continueTask){sessionReward=0;taskCompleted=0}$('#sessionView').classList.toggle('review-session',type==='review');$('#modePill').textContent=type==='review'?'唤醒记忆':'认识新单词';showView('sessionView');renderCard();
  }
  function startSimpleTask(){if(due().length)start('review');else if(availableNew().length)start('new');else toast('今天的任务已经全部完成啦')}
  const normalizeSpelling=text=>String(text||'').normalize('NFKC').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
  const escapeRegExp=text=>String(text).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function clozeText(word){
    const source=word.example||'',pattern=new RegExp(`\\b${escapeRegExp(word.word)}\\b`,'i');
    return pattern.test(source)?source.replace(pattern,'______'):'';
  }
  function chooseReviewMode(word){
    const stage=getState(word.id)?.stage||1;
    if(stage<=1)return 'meaning';
    if(stage===2||stage===5)return 'audio-spelling';
    if((stage===3||stage>=6)&&clozeText(word))return 'cloze';
    return 'meaning-spelling';
  }
  function meaningOptions(word){
    const seen=new Set([word.zh]),choices=[{text:word.zh,correct:true}];
    const pool=WORDS.filter(item=>item.id!==word.id&&item.zh&&!seen.has(item.zh));
    let seed=[...word.word].reduce((sum,char)=>sum+char.charCodeAt(0),0);
    while(choices.length<3&&pool.length){
      seed=(seed*9301+49297)%233280;
      const item=pool[seed%pool.length];
      if(!seen.has(item.zh)){seen.add(item.zh);choices.push({text:item.zh,correct:false})}
    }
    const shift=seed%choices.length;
    return [...choices.slice(shift),...choices.slice(0,shift)];
  }
  function renderMeaningChoices(word){
    const wrap=$('#meaningChoices'),feedback=$('#meaningChoiceFeedback');
    simpleAnswerResult='again';feedback.textContent='';feedback.className='spelling-feedback';wrap.innerHTML='';
    for(const option of meaningOptions(word)){
      const button=document.createElement('button');button.type='button';button.textContent=option.text;button.dataset.correct=option.correct?'1':'0';
      button.addEventListener('click',()=>{
        const correct=button.dataset.correct==='1';
        [...wrap.children].forEach(choice=>{choice.disabled=true;if(choice.dataset.correct==='1')choice.classList.add('correct')});
        if(!correct)button.classList.add('wrong');
        simpleAnswerResult=correct?'good':'again';
        feedback.textContent=correct?'答对了，马上进入下一题！':'没关系，记住绿色答案，马上进入下一题';
        feedback.className=`spelling-feedback ${correct?'correct':'miss'}`;
        setTimeout(()=>answer(simpleAnswerResult,button),650);
      });
      wrap.appendChild(button);
    }
  }
  function renderCard(){
    const w=session[sessionIndex];if(!w){finishSession();return}
    $('#sessionStep').textContent=`${sessionIndex+1} / ${session.length}`;$('#sessionBar').style.width=`${sessionIndex/session.length*100}%`;
    recallMode=sessionType==='review'?chooseReviewMode(w):'meaning';spellingAttempts=0;usedAudioHint=false;spellingResult='again';
    $('#cardPlanet').textContent=w.emoji;$('#wordPart').textContent=w.part;$('#wordText').textContent=w.word;$('#phoneticText').textContent=w.ipa;
    $('#wordZh').textContent=w.zh;$('#wordExample').textContent=w.example;$('#exampleZh').textContent=w.exampleZh;
    $('#answerArea').classList.add('hidden');$('#answerButtons').classList.add('hidden');$('#recallArea').classList.add('hidden');$('#meaningChoiceArea').classList.add('hidden');$('#simpleCardNext').classList.add('hidden');
    $('#wordPart').classList.remove('hidden');$('#wordText').classList.remove('hidden');$('#phoneticText').classList.remove('hidden');
    if(recallMode==='meaning'){
      if(data.settings.simpleMode&&sessionType==='review'){
        $('#revealArea').classList.add('hidden');$('#meaningChoiceArea').classList.remove('hidden');$('#modePill').textContent='选出中文意思';renderMeaningChoices(w);
      }else if(data.settings.simpleMode){
        $('#revealArea').classList.add('hidden');$('#answerArea').classList.remove('hidden');$('#modePill').textContent='认识新单词';
        simpleAnswerResult='good';$('#simpleCardNext').textContent='学会了，下一个';$('#simpleCardNext').classList.remove('hidden');
      }else{
        $('#revealArea').classList.remove('hidden');$('#modePill').textContent=sessionType==='review'?'英文辨义':'认识新单词';
      }
    }else{
      $('#revealArea').classList.add('hidden');$('#recallArea').classList.remove('hidden');
      $('#wordPart').classList.add('hidden');$('#wordText').classList.add('hidden');$('#phoneticText').classList.add('hidden');
      $('#recallChinese').classList.toggle('hidden',recallMode==='cloze');
      $('#clozeSentence').classList.toggle('hidden',recallMode!=='cloze');$('#clozeTranslation').classList.toggle('hidden',recallMode!=='cloze');
      $('#recallChinese').textContent=w.zh;$('#clozeSentence').textContent=clozeText(w);$('#clozeTranslation').textContent=w.exampleZh||w.zh;
      $('#recallType').textContent=recallMode==='audio-spelling'?'听读音，拼出英文单词':recallMode==='cloze'?'根据例句，填入正确的单词':'根据中文，拼出英文单词';
      $('#modePill').textContent=recallMode==='audio-spelling'?'听音拼写':recallMode==='cloze'?'例句填空':'中文拼写';
      $('#spellingInput').value='';$('#spellingInput').disabled=false;$('#spellingFeedback').textContent='';$('#spellingFeedback').className='spelling-feedback';
      $('#spellingActions').classList.remove('hidden');$('#checkSpelling').classList.remove('hidden');$('#continueSpelling').classList.add('hidden');
      setTimeout(()=>$('#spellingInput').focus(),180);
    }
    $('#wordCard').animate?.([{transform:'translateX(16px)',opacity:.4},{transform:'translateX(0)',opacity:1}],{duration:280,easing:'ease-out'});
    if(sessionType==='review'&&matchMedia('(max-width:760px)').matches)scrollTo({top:0,behavior:'auto'});
    if(data.settings.autoSpeak&&(recallMode==='meaning'||recallMode==='audio-spelling'))setTimeout(()=>speak(w.word),300);
  }
  function reveal(){$('#revealArea').classList.add('hidden');$('#answerArea').classList.remove('hidden');$('#answerButtons').classList.remove('hidden')}
  function spellingHint(word){
    let firstShown=false,letters=0;
    const mask=[...word].map(char=>{if(/[a-z]/i.test(char)){letters++;if(!firstShown){firstShown=true;return char}return '_'}return char}).join(' ');
    return `再试一次：${mask}（共 ${letters} 个字母）`;
  }
  function finishSpelling(result,message,target=$('#checkSpelling')){
    spellingResult=result;$('#spellingInput').disabled=true;$('#spellingActions').classList.add('hidden');
    const autoNext=data.settings.simpleMode&&sessionType==='review';
    $('#continueSpelling').classList.toggle('hidden',autoNext);$('#continueSpelling').textContent=result==='again'?'记住答案，继续':'太棒了，继续';$('#spellingFeedback').textContent=autoNext?`${message}，马上进入下一题`:message;
    $('#spellingFeedback').className=`spelling-feedback ${result==='again'?'miss':'correct'}`;
    if(autoNext)setTimeout(()=>answer(result,target),750);
  }
  function checkSpelling(){
    const w=session[sessionIndex],value=normalizeSpelling($('#spellingInput').value),target=normalizeSpelling(w.word);
    if(!value){$('#spellingFeedback').textContent='先输入你想到的英文单词吧';return}
    if(value===target){finishSpelling(spellingAttempts||usedAudioHint?'hard':'good',`拼写正确：${w.word}`);return}
    spellingAttempts++;
    if(spellingAttempts<2){$('#spellingFeedback').textContent=spellingHint(w.word);$('#spellingFeedback').className='spelling-feedback retry';$('#spellingInput').select()}
    else finishSpelling('again',`正确答案是：${w.word}`);
  }
  function showSpellingAnswer(){const w=session[sessionIndex];finishSpelling('again',`正确答案是：${w.word}`,$('#showSpellingAnswer'))}
  function answer(result,target){
    const w=session[sessionIndex],t=today(),wasNew=!getState(w.id),previous=getState(w.id)||{stage:0,seen:0,correct:0};
    const state=scheduleAnswer(previous,result,t);
    state.seen++;state.lastReviewed=t;
    if(wasNew){state.learnedOn=t;dayStats().new++}else dayStats().review++;
    if(result==='good')state.correct++;
    data.words[w.id]=state;
    const rewardKey=`${t}-${w.id}`;if(!data.rewarded[rewardKey]){data.rewarded[rewardKey]=1;data.stars++;dayStats().stars++;sessionReward++}
    taskCompleted++;save();$('#totalStars').textContent=data.stars;starBurst(target);sessionIndex++;setTimeout(renderCard,260);
  }
  function starBurst(target){
    const box=target?.getBoundingClientRect?.()||{left:innerWidth/2,top:innerHeight/2,width:1,height:1};
    for(let i=0;i<8;i++){const s=document.createElement('i');s.textContent='⭐';s.style.cssText=`position:fixed;z-index:20;left:${box.left+box.width/2}px;top:${box.top}px;font-style:normal;pointer-events:none;font-size:${12+Math.random()*12}px;--x:${(Math.random()-.5)*150}px;--y:${-40-Math.random()*100}px`;document.body.appendChild(s);s.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:'translate(var(--x),var(--y)) scale(1.1)',opacity:0}],{duration:700,easing:'ease-out'}).onfinish=()=>s.remove()}
  }
  function finishSession(){
    if(data.settings.simpleMode&&sessionType==='review'&&availableNew().length){
      $('#sessionBar').style.width='100%';toast('复习完成，接着学习今天的新词');
      setTimeout(()=>start('new',true),420);return;
    }
    $('#sessionBar').style.width='100%';$('#rewardStars').textContent=sessionReward;
    $('#completeSummary').textContent=data.settings.simpleMode?`今天一共完成了 ${taskCompleted} 个单词，任务完成！`:`完成了 ${session.length} 个${sessionType==='review'?'复习':'新单词'}，每颗星都很闪亮！`;
    showView('completeView')
  }
  function speak(text){if(!('speechSynthesis'in window)){toast('这台设备暂不支持朗读');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='en-GB';u.rate=.78;speechSynthesis.speak(u)}

  function renderWords(){
    const q=$('#wordSearch').value.trim().toLowerCase();let list=WORDS.filter(w=>w.word.includes(q)||w.zh.includes(q));
    if(currentFilter==='learning')list=list.filter(w=>getState(w.id)&&!getState(w.id).completed&&getState(w.id).stage<7);
    if(currentFilter==='mastered')list=list.filter(w=>getState(w.id)?.completed||getState(w.id)?.stage>=7);
    $('#wordList').innerHTML=list.map(w=>{const s=getState(w.id),done=s&&(s.completed||s.stage>=7),kind=!s?'new':done?'mastered':'learning',label=!s?'未遇见':done?'已掌握':`记忆等级 ${s.stage}`;return `<article class="word-row ${kind}"><span class="state">${!s?'🌑':done?'🌟':'🌱'}</span><div><b>${w.word}</b><small>${w.zh} · ${label}</small></div><button aria-label="朗读 ${w.word}" data-speak="${w.word}">🔊</button></article>`}).join('')||'<p>这里还没有单词。</p>';
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
      const finalDate=finalReviewDate(getState(word.id));
      if(finalDate)finalReviewOffset=Math.max(finalReviewOffset,Math.max(0,dayDistance(today(),finalDate)));
    }
    if(remaining>0)finalReviewOffset=Math.max(finalReviewOffset,lastNewOffset+MILESTONES[MILESTONES.length-1]);
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

  function renderTestControls(){
    $('#testInactive').hidden=testMeta.active;
    $('#testActive').hidden=!testMeta.active;
    if(!testMeta.active)return;
    $('#testStartDate').textContent=formatDate(testMeta.startedOn);
    $('#testCurrentDate').textContent=formatDate(testMeta.simulatedDate);
    const currentDay=dayDistance(testMeta.startedOn,testMeta.simulatedDate);
    $$('.test-day-button').forEach(button=>button.classList.toggle('active',Number(button.dataset.day)===currentDay));
  }
  function enterTestMode(){
    if(!confirm('进入家长测试模式后，将使用一套独立的测试记录。孩子的正式学习记录不会改变。确定进入吗？'))return;
    let formal=fresh();
    try{formal=normalize(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
    testMeta={active:true,startedOn:realToday(),simulatedDate:realToday()};
    data=fresh();data.settings={...formal.settings,goal:5};
    localStorage.setItem(TEST_KEY,JSON.stringify(data));saveTestMeta();
    skipSettingsClose=true;$('#settingsDialog').close();renderHome();showView('homeView');toast('已进入家长测试模式');
  }
  function jumpTestDay(day){
    testMeta.simulatedDate=addDays(testMeta.startedOn,Number(day)||0);saveTestMeta();
    renderTestControls();updateStudyEstimate(data.settings.goal);renderHome();toast(`已模拟到第 ${day} 天`);
  }
  function resetTestMode(){
    if(!confirm('确定清空测试记录，并回到测试第0天吗？正式学习记录不会受到影响。'))return;
    const settings={...data.settings,goal:5};data=fresh();data.settings=settings;
    testMeta.startedOn=realToday();testMeta.simulatedDate=realToday();save();saveTestMeta();
    renderTestControls();updateStudyEstimate(data.settings.goal);renderHome();toast('测试记录已重新开始');
  }
  function exitTestMode(){
    if(!confirm('退出测试模式并返回孩子的正式学习记录吗？测试记录会保留，正式记录不会改变。'))return;
    testMeta.active=false;saveTestMeta();data=load();
    skipSettingsClose=true;$('#settingsDialog').close();renderHome();showView('homeView');toast('已返回正式学习模式');
  }

  $('#startButton').addEventListener('click',()=>start('new'));$('#reviewButton').addEventListener('click',()=>start('review'));$('#simpleStartButton').addEventListener('click',startSimpleTask);
  $('#modeSwitchButton').addEventListener('click',()=>{
    if($('#sessionView').classList.contains('active')&&!confirm('切换模式需要先回到首页。已经完成的单词会保留，确定切换吗？'))return;
    data.settings.simpleMode=!data.settings.simpleMode;save();renderHome();showView('homeView');toast(data.settings.simpleMode?'已切换到简单模式':'已切换到经典模式');
  });
  $('#revealButton').addEventListener('click',reveal);$('#speakButton').addEventListener('click',()=>{if(recallMode!=='meaning'&&recallMode!=='audio-spelling')usedAudioHint=true;speak(session[sessionIndex].word)});
  $('#checkSpelling').addEventListener('click',checkSpelling);$('#showSpellingAnswer').addEventListener('click',showSpellingAnswer);
  $('#spellingInput').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();checkSpelling()}});
  $('#continueSpelling').addEventListener('click',event=>answer(spellingResult,event.currentTarget));
  $('#simpleCardNext').addEventListener('click',event=>answer(simpleAnswerResult,event.currentTarget));
  $$('.answer-btn').forEach(b=>b.addEventListener('click',e=>answer(e.currentTarget.dataset.answer,e.currentTarget)));
  $('#exitSession').addEventListener('click',()=>{if(confirm('要先回到首页吗？已经完成的单词会保留。')){renderHome();showView('homeView')}});
  $('#backHome').addEventListener('click',()=>{renderHome();showView('homeView')});
  $('#allWordsButton').addEventListener('click',()=>{renderWords();showView('wordsView')});$('#wordsBack').addEventListener('click',()=>{renderHome();showView('homeView')});
  $('#wordSearch').addEventListener('input',renderWords);$('.filter-row').addEventListener('click',e=>{if(!e.target.matches('.filter'))return;$$('.filter').forEach(x=>x.classList.remove('active'));e.target.classList.add('active');currentFilter=e.target.dataset.filter;renderWords()});
  $('#wordList').addEventListener('click',e=>{const b=e.target.closest('[data-speak]');if(b)speak(b.dataset.speak)});
  $('#settingsButton').addEventListener('click',()=>{openSettings();renderTestControls()});$('#dailyGoal').addEventListener('input',e=>{$('#goalValue').textContent=e.target.value;updateStudyEstimate(e.target.value)});
  $('#settingsDialog').addEventListener('close',()=>{if(skipSettingsClose){skipSettingsClose=false;return}data.settings.goal=Number($('#dailyGoal').value);data.settings.autoSpeak=$('#autoSpeak').checked;save();renderHome()});
  $('#exportButton').addEventListener('click',exportProgress);$('#importButton').addEventListener('click',()=>$('#importFile').click());$('#importFile').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importProgress(file)});
  $('#enterTestMode').addEventListener('click',enterTestMode);
  $$('.test-day-button').forEach(button=>button.addEventListener('click',()=>jumpTestDay(button.dataset.day)));
  $('#nextTestDay').addEventListener('click',()=>jumpTestDay(dayDistance(testMeta.startedOn,testMeta.simulatedDate)+1));
  $('#resetTestMode').addEventListener('click',resetTestMode);$('#exitTestMode').addEventListener('click',exitTestMode);
  $('#resetButton').addEventListener('click',()=>{if(confirm('确定清空这台设备上的全部学习记录吗？这一步不能恢复。')){data=fresh();save();$('#settingsDialog').close();renderHome();toast('学习记录已清空')}});
  $('#starsChip').addEventListener('click',()=>toast(`你已经收集了 ${data.stars} 颗星星！`));
  window.addEventListener('hashchange',()=>{if(location.hash==='#home'){renderHome();showView('homeView')}});
  if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js?v=17',{updateViaCache:'none'}).catch(()=>{});
  renderHome();
})();
