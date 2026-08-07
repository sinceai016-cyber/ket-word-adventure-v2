(function(root){
  'use strict';
  const MILESTONES=[0,1,3,7,14,30,60];
  const addDays=(date,n)=>{
    const d=new Date(`${date}T12:00:00`);
    d.setDate(d.getDate()+n);
    return d.toLocaleDateString('en-CA');
  };
  const dayDistance=(from,to)=>Math.round((new Date(`${to}T12:00:00`)-new Date(`${from}T12:00:00`))/86400000);
  const normalizeStage=value=>Math.max(0,Math.min(7,Number(value)||0));

  function scheduleAnswer(previous,result,reviewDate){
    const state={...(previous||{})};
    state.learnedOn=state.learnedOn||reviewDate;
    state.cycleStartedOn=state.cycleStartedOn||state.learnedOn;
    state.completed=false;
    const stage=normalizeStage(state.stage);
    if(result==='again'){
      state.stage=0;state.cycleStartedOn=reviewDate;state.due=addDays(reviewDate,1);return state;
    }
    if(result==='hard'){
      state.stage=Math.max(1,Math.min(6,stage));state.due=addDays(reviewDate,1);return state;
    }
    let nextStage=stage+1;
    while(nextStage<=6&&addDays(state.cycleStartedOn,MILESTONES[nextStage])<=reviewDate)nextStage++;
    if(nextStage>6){state.stage=7;state.completed=true;state.due=null}
    else{state.stage=nextStage;state.due=addDays(state.cycleStartedOn,MILESTONES[nextStage])}
    return state;
  }

  function finalReviewDate(state){
    if(!state||state.completed||normalizeStage(state.stage)>=7)return null;
    const cycleStart=state.cycleStartedOn||state.learnedOn;
    return cycleStart?addDays(cycleStart,60):(state.due||null);
  }

  const api={MILESTONES,addDays,dayDistance,scheduleAnswer,finalReviewDate};
  root.KET_SCHEDULER=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
