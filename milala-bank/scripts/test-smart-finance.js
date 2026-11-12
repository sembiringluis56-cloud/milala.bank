'use strict';
// In-memory simulation of the Firebase Admin storage API: no production access.
const assert=require('node:assert/strict');
const Module=require('node:module');
const original=Module._load;
const copy = (value) => value === undefined ? null : JSON.parse(JSON.stringify(value));
let activeListeners = 0, injectConcurrentFinanceWrite = false;

const storage={
  'milala_secure/customerProfiles/customerA':{active:true,customerId:'C-A'},
  'milala_secure/customerProfiles/customerB':{active:true,customerId:'C-B'},
  'milala_secure/staffProfiles/adminA':{active:true,role:'admin',staffId:'S-A'}
};
function snapshot(path){
  const value=storage[path]===undefined?null:JSON.parse(JSON.stringify(storage[path]));
  return {val:()=>value,exists:()=>value!==null,key:path.split('/').pop(),
    forEach:(fn)=>{if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))fn({key,val:()=>child});}};
}
class Ref{
  constructor(path){this.path=path;}
  child(key){return new Ref(`${this.path}/${key}`);}
  async get(){
    if(this.last!==undefined){const value=storage[this.path]||{};const sorted=Object.fromEntries(Object.entries(value).slice(-this.last));return {val:()=>sorted,exists:()=>Object.keys(sorted).length>0,forEach:fn=>Object.entries(sorted).forEach(([key,val])=>fn({key,val:()=>val}))};}
    return snapshot(this.path);
  }
  on(event, callback) {
    assert.equal(event, 'value');
    this.listener = callback;
    this.cachedValue = copy(storage[this.path]);
    activeListeners++;
    queueMicrotask(() => callback(snapshot(this.path)));
    return callback;
  }
  off(event, callback) {
    assert.equal(event, 'value');
    if (this.listener === callback) { this.listener = null; activeListeners--; }
  }
  async transaction(cb) {
    // Firebase Admin starts a transaction from its local cache. On a new
    // serverless invocation it can be null even when server data exists.
    const cached = this.listener ? copy(this.cachedValue) : null;
    let next = cb(cached);
    if (next === undefined) return {committed:false,snapshot:snapshot(this.path)};
    if (injectConcurrentFinanceWrite && this.path.endsWith('/financeWorkspaces/customerA')) {
      injectConcurrentFinanceWrite = false;
      storage[this.path] = {...storage[this.path], revision:storage[this.path].revision+1, updatedAt:'simulated-concurrent-write'};
    }
    const remote = copy(storage[this.path]);
    if (JSON.stringify(cached) !== JSON.stringify(remote)) {
      next = cb(remote);
      if (next === undefined) return {committed:false,snapshot:snapshot(this.path)};
    }
    storage[this.path] = next;
    return {committed:true,snapshot:snapshot(this.path)};
  }
  orderByKey(){return this;}
  limitToLast(n){this.last=n;return this;}
  async push(value){if(!storage[this.path])storage[this.path]={};storage[this.path][`id_${Object.keys(storage[this.path]).length}`]=value;}
}
Module._load=function(name,parent,isMain){
  if(name==='firebase-admin/app')return {initializeApp:()=>{},cert:()=>({}),getApps:()=>[]};
  if(name==='firebase-admin/auth')return {getAuth:()=>({})};
  if(name==='firebase-admin/database')return {getDatabase:()=>({ref:path=>new Ref(path)})};
  return original.apply(this,arguments);
};
process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'luis-sistem-informasi',private_key:'FAKE TEST KEY'});
const backend=require('../lib/banking');
Module._load=original;
const makeReq=(uid,kind='customer')=>({auth:{uid,token:kind==='customer'?{role:'customer',customerId:uid==='customerA'?'C-A':'C-B',email_verified:true}:{role:'admin',staff:true,staffId:'S-A'}}});
const empty={version:1,revision:0,banks:[],goals:[],invoices:[],entries:[],familyMembers:[],familyBudgets:[]};
(async()=>{
  let a=await backend.getFinanceWorkspace(makeReq('customerA'));
  assert.equal(a.workspace.revision,0);
  const payload={...empty,banks:[{id:'bank_manual_001',name:'Testing',bank:'Demo Bank',type:'Tabungan',balance:1000000,note:''}]};
  a=await backend.saveFinanceWorkspace({...makeReq('customerA'),data:{workspace:payload,expectedRevision:0}});
  assert.equal(a.workspace.revision,1);
  assert.equal(a.workspace.banks[0].balance,1000000);
  // Regression: first save succeeds, then a different form is saved in a
  // separate request (cold Firebase transaction cache).
  const memberPayload={...a.workspace,familyMembers:[{id:'member_luis_001',name:'luis',role:'kakak laki laki'}]};
  a=await backend.saveFinanceWorkspace({...makeReq('customerA'),data:{workspace:memberPayload,expectedRevision:1}});
  assert.equal(a.workspace.revision,2);
  const budgetPayload={...a.workspace,familyBudgets:[{id:'budget_food_001',category:'Makanan',limit:500000,used:0,note:''}]};
  a=await backend.saveFinanceWorkspace({...makeReq('customerA'),data:{workspace:budgetPayload,expectedRevision:2}});
  assert.equal(a.workspace.revision,3);
  assert.equal(a.workspace.familyMembers[0].name,'luis');
  assert.equal(a.workspace.familyBudgets[0].limit,500000);
  assert.equal(activeListeners,0,'Value listeners must always be cleaned up');
  const b=await backend.getFinanceWorkspace(makeReq('customerB'));
  assert.equal(b.workspace.banks.length,0,'Customers must not read another UID workspace');
  await assert.rejects(()=>backend.saveFinanceWorkspace({...makeReq('customerA'),data:{workspace:payload,expectedRevision:0}}),{code:'aborted'});
  injectConcurrentFinanceWrite=true;
  await assert.rejects(()=>backend.saveFinanceWorkspace({...makeReq('customerA'),data:{workspace:budgetPayload,expectedRevision:3}}),{code:'aborted'});
  assert.equal(storage['milala_secure/financeWorkspaces/customerA'].revision,4,'Concurrent writer data preserved');
  assert.equal(activeListeners,0,'Listeners must be removed after conflicts too');
  await assert.rejects(()=>backend.saveFinanceWorkspace({...makeReq('customerB'),data:{workspace:{...empty,banks:[{...payload.banks[0],balance:-1}]},expectedRevision:0}}),{code:'invalid-argument'});
  await assert.rejects(()=>backend.getFinanceWorkspace({auth:{uid:'invalid',token:{role:'customer',customerId:'C-A',email_verified:true}}}),{code:'permission-denied'});
  assert.equal(Object.keys(storage).filter(k=>k.startsWith('milala_core_banking')).length,0,'Bank core must remain untouched');
  assert.deepEqual(await backend.submitFeedback({data:{type:'saran',name:'A',email:'',message:'A very useful suggestion'},meta:{ip:'192.0.2.1'}}),{ok:true});
  await assert.rejects(()=>backend.submitFeedback({data:{type:'saran',name:'A',email:'',message:'A second suggestion'},meta:{ip:'192.0.2.1'}}),{code:'resource-exhausted'});
  const received=await backend.getFeedback(makeReq('adminA','staff'));
  assert.equal(received.items.length,1);
  await assert.rejects(()=>backend.getFeedback(makeReq('customerA')),{code:'permission-denied'});
  console.log('PASS: cold-cache Firebase transactions, repeat saves, genuine conflicts, scoped storage, validation, bank-core isolation, feedback throttling and admin-only inbox');
})().catch(error=>{console.error(error);process.exit(1)});
