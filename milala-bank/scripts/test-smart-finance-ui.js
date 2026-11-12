'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let workspace={version:1,revision:0,banks:[],goals:[],invoices:[],entries:[],familyMembers:[],familyBudgets:[]};
const store={
  getFinanceWorkspace:async()=>({workspace}),
  saveFinanceWorkspace:async(next,rev)=>{assert.equal(rev,workspace.revision);workspace={...next,revision:rev+1};return {workspace};},
  getFeedback:async()=>({items:[{name:'Tester',email:'',type:'saran',message:'Feedback',createdAt:'2026-11-12'}]}),
  submitFeedback:async()=>({ok:true}),
  changePassword:async()=>{},
  balance:()=>250000
};
const storage=new Map();
const ctx={console,setTimeout,clearTimeout,Intl,Date,JSON,Math,crypto:require('node:crypto').webcrypto,
  window:{MBStore:store},document:{documentElement:{},querySelector:()=>null},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  confirm:()=>true,
  FormData:class{constructor(form){this.entriesData=form.entriesData||[];}entries(){return this.entriesData[Symbol.iterator]();}get(k){return this.entriesData.find(x=>x[0]===k)?.[1];}[Symbol.iterator](){return this.entries();}},
  MutationObserver:class{observe(){}},NodeFilter:{SHOW_TEXT:4}
};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/js/ecosystem.js'),'utf8'),ctx);
const eco=ctx.window.MBEco;
const customer={isCustomer:true,state:{accounts:[{id:'a',status:'Aktif',product:'Tabungan',number:'111'}]}};
const form=(kind,values,id='')=>({id:'eco-record-form',dataset:{ecoKind:kind,ecoId:id},entriesData:Object.entries(values)});
(async()=>{
  assert.equal(eco.nav().length,11);
  assert(eco.publicTeaser().includes('SMART FINANCE ECOSYSTEM'));
  assert(eco.publicFeedback().includes('eco-feedback-form'));
  await eco.ensureLoaded();
  assert(eco.render('eco-dashboard',customer).includes('Dashboard Keuangan'));
  await eco.click('eco-new','banks',customer);
  assert(eco.render('eco-banks',customer).includes('eco-record-form'));
  await eco.submit(form('banks',{name:'External account',bank:'Demo Bank',type:'Tabungan',balance:'200000',note:''}),customer);
  assert.equal(workspace.banks.length,1);
  await eco.click('eco-new','goals',customer);
  await eco.submit(form('goals',{name:'Laptop',target:'5000000',saved:'250000',note:''}),customer);
  assert.equal(workspace.goals.length,1);
  await eco.click('eco-new','entries',customer);
  await eco.submit(form('entries',{title:'Service fee',category:'Freelance',type:'income',scope:'business',amount:'700000',date:'2026-11-12',note:''}),customer);
  assert.equal(workspace.entries.length,1);
  await eco.click('eco-new','invoices',customer);
  await eco.submit(form('invoices',{title:'Bill',party:'Provider',type:'expense',status:'unpaid',amount:'100000',due:'2026-11-13',note:''}),customer);
  assert.equal(workspace.invoices.length,1);
  await eco.click('eco-new','familyMembers',customer);
  await eco.submit(form('familyMembers',{name:'Member 1',role:'Parent'}),customer);
  await eco.click('eco-new','familyBudgets',customer);
  await eco.submit(form('familyBudgets',{category:'Groceries',limit:'1500000',used:'500000',note:''}),customer);
  assert.equal(workspace.familyBudgets.length,1);
  const views=['eco-dashboard','eco-assistant','eco-analytics','eco-banks','eco-goals','eco-invoices','eco-business','eco-security','eco-reports','eco-family','eco-feedback'];
  for(const view of views){const out=eco.render(view,customer);assert(out.includes('eco-root'),view);assert(!out.includes('undefined'),view);}
  eco.setLocale('en');assert(eco.render('eco-goals',customer).includes('Savings Goals'));
  eco.setLocale('zh');assert(eco.render('eco-goals',customer).includes('储蓄目标'));
  eco.setLocale('id');
  assert.equal(workspace.revision,6);
  console.log('PASS: menu, templates, persistence, all 11 modules, ID/English/Chinese language switching');
})().catch(err=>{console.error(err);process.exit(1);});
