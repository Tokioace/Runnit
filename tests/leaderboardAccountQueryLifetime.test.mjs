import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {currentLeaderboardSnapshot} from '../src/lib/leaderboardSnapshot.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const key=(account,tab,metric,distance,revision)=>JSON.stringify([account,tab,metric,distance,revision]);
test('old leaderboard data cannot be rendered for another account, tab, metric, distance or refresh',()=>{
 const original=key('A','records','times',50,0);
 const snapshot={key:original,rows:[{value:6000}],error:null};
 assert.equal(currentLeaderboardSnapshot(snapshot,original),snapshot);
 for(const next of [key('B','records','times',50,0),key(null,'records','times',50,0),key('A','ladder','times',50,0),key('A','records','speed',50,0),key('A','records','times',100,0),key('A','records','times',50,1)]){
  assert.equal(currentLeaderboardSnapshot(snapshot,next),null);
 }
 assert.equal(currentLeaderboardSnapshot(null,original),null);
});
test('old errors and ranking consent do not follow the new query or account',()=>{
 const snapshot={key:'A',value:true,error:'old'};
 assert.equal(currentLeaderboardSnapshot(snapshot,'B'),null);
 assert.equal(currentLeaderboardSnapshot(snapshot,'A'),snapshot);
});
test('Legends remounts with account and scopes async state before rendering',()=>{
 const app=read('src/App.tsx'),screen=read('src/screens/LeaderboardScreen.tsx');
 assert.ok(app.includes("<LeaderboardScreen key={auth.user?.id ?? 'guest'}"));
 assert.ok(screen.includes('currentLeaderboardSnapshot(board,boardKey)'));
 assert.ok(screen.includes('currentLeaderboardSnapshot(consentResult,consentKey)'));
 assert.ok(screen.includes('const loading=tab!==\'rivals\'&&!currentBoard;'));
 assert.ok(screen.includes('if(active)setBoard({key:boardKey'));
 assert.ok(screen.includes('if(active)setConsentResult({key:consentKey'));
 assert.ok(screen.includes('return()=>{active=false;};'));
});
