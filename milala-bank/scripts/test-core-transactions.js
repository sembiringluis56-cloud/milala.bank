'use strict';
// Regression tests for core banking mutations without touching production data.
// Models the Firebase Realtime Database cold-cache transaction behavior.
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
const copy = (v) => v === undefined ? null : JSON.parse(JSON.stringify(v));
const rootPath = 'milala_core_banking';
const accountId = 'ACC-0001';
const customerId = 'NSB-0001';
const staffId = 'USR-0001';
const storage = {
  [rootPath]: {
    version: 1, revision: 0,
    users: [{id: staffId, uid: 'staff-auth', name:'Demo Admin', email:'staff@example.test', role:'admin',branch:'BR-0001',active:true}],
    customerUsers: [{id:'customer-auth',uid:'customer-auth',customerId,email:'customer@example.test',active:true}],
    branches: [{id:'BR-0001',code:'JKT',name:'Jakarta',city:'Jakarta',active:true}],
    customers: [{id:customerId,name:'Demo Customer',identity:'DEMO-KYC',email:'customer@example.test',phone:'0800000000',branch:'BR-0001',status:'Aktif',createdAt:'2026-11-12',authUid:'customer-auth'}],
    accounts: [{id:accountId,number:'ML-1000000001',customerId,product:'Tabungan',branch:'BR-0001',status:'Aktif',openedAt:'2026-11-12'}],
    transactions: [], journal: [], loans: [], audit: [],
    settings: {bankName:'MILALA BANK',currency:'IDR',theme:'light'},
    counters: {customer:2,account:2,transaction:1,loan:1,log:1}
  },
  'milala_secure/customerProfiles/customer-auth':{customerId,active:true},
  'milala_secure/staffProfiles/staff-auth':{staffId,role:'admin',active:true,branch:'BR-0001'}
};
let activeListeners = 0;
let coldCacheHits = 0;
const snap = (key) => {const value=copy(storage[key]); return {val:()=>value,exists:()=>value!==null};};
class Ref {
  constructor(path){this.path=path;this.listener=null;this.cached=undefined;}
  child(key){return new Ref(`${this.path}/${key}`);}
  async get(){return snap(this.path);}
  on(event, cb){
    assert.equal(event,'value');
    this.listener=cb;
    this.cached=copy(storage[this.path]);
    activeListeners++;
    queueMicrotask(()=>cb(snap(this.path)));
    return cb;
  }
  off(event,cb){
    assert.equal(event,'value');
    if(this.listener===cb){activeListeners--;this.listener=null;}
  }
  async transaction(updater){
    if(!this.listener) coldCacheHits++;
    let initial=this.listener?copy(this.cached):null;
    let next=updater(initial);
    if(next===undefined)return {committed:false,snapshot:snap(this.path)};
    const actual=copy(storage[this.path]);
    if(JSON.stringify(initial)!==JSON.stringify(actual)){
      next=updater(actual);
      if(next===undefined)return {committed:false,snapshot:snap(this.path)};
    }
    storage[this.path]=copy(next);
    return {committed:true,snapshot:snap(this.path)};
  }
}
Module._load=function(name,parent,isMain){
  if(name==='firebase-admin/app')return {initializeApp:()=>{},cert:()=>({}),getApps:()=>[]};
  if(name==='firebase-admin/auth')return {getAuth:()=>({})};
  if(name==='firebase-admin/database')return {getDatabase:()=>({ref:path=>new Ref(path)})};
  return originalLoad.apply(this,arguments);
};
process.env.FIREBASE_SERVICE_ACCOUNT_JSON=JSON.stringify({project_id:'luis-sistem-informasi',private_key:'MOCK ONLY'});
const backend=require('../lib/banking');
Module._load=originalLoad;
const staffReq=(data={})=>({auth:{uid:'staff-auth',token:{staff:true,role:'admin',staffId}},data});
const customerReq=(data={})=>({auth:{uid:'customer-auth',token:{role:'customer',customerId,email_verified:true}},data});
const balance=(id)=>storage[rootPath].journal.reduce((a,x)=>a+(x.account===id?x.delta:0),0);
(async()=>{
  const before=copy(storage[rootPath]);
  assert.equal(before.accounts[0].status,'Aktif');
  const loan=await backend.applyCustomerLoan(customerReq({accountId,product:'Kredit Multiguna',principal:120000000,term:60}));
  assert.match(loan.loanId,/^LN-/);
  assert.equal(loan.state.loans.length,1);
  assert.equal(storage[rootPath].revision,1);
  assert.equal(activeListeners,0,'Reader listeners must be released');
  const loanCount=storage[rootPath].loans.length;
  await assert.rejects(
    ()=>backend.applyCustomerLoan(customerReq({accountId:'ACC-NOT-MINE',product:'Kredit Multiguna',principal:120000000,term:60})),
    {code:'failed-precondition'}
  );
  assert.equal(storage[rootPath].loans.length,loanCount,'Invalid account must not create a loan');
  const next=copy(storage[rootPath]);
  const stamp=new Date().toISOString();
  const amount=5000000;
  next.transactions.push({id:'TRX-000001',type:'Setor Tunai',from:'GL-CASH',to:accountId,amount,description:'Transaksi teller demo',date:stamp,actor:staffId,status:'Berhasil'});
  next.journal.push({id:'J-TRX-000001-D',transactionId:'TRX-000001',account:'GL-CASH',delta:-amount,date:stamp});
  next.journal.push({id:'J-TRX-000001-C',transactionId:'TRX-000001',account:accountId,delta:amount,date:stamp});
  next.audit.unshift({id:'LOG-00002',date:stamp,actor:staffId,action:'TRANSAKSI',module:'Transaksi',description:'Setor tunai demo'});
  next.counters.transaction=2;next.counters.log=3;
  const saved=await backend.commitStaffSnapshot(staffReq({state:next,expectedRevision:1}));
  assert.equal(saved.state.revision,2);
  assert.equal(saved.state.transactions.length,1);
  assert.equal(balance(accountId),amount);
  assert.equal(activeListeners,0,'Reader listeners must be released after successful commit');
  // A stale frontend must be rejected, not allowed to overwrite the ledger.
  await assert.rejects(()=>backend.commitStaffSnapshot(staffReq({state:next,expectedRevision:1})),{code:'aborted'});
  assert.equal(storage[rootPath].transactions.length,1);
  assert.equal(balance(accountId),amount);
  assert.equal(activeListeners,0,'Reader listeners must be released after conflict');
  assert.equal(coldCacheHits,0,'Core mutations must warm Firebase cache');
  console.log('PASS: active-account credit application, teller deposit, double-entry ledger, stale-revision protection, cold-cache listener cleanup');
})().catch(err=>{console.error(err);process.exitCode=1});
