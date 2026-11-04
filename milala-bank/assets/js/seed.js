/* Fiktif sepenuhnya. Nomor rekening, identitas, dan cabang bukan data bank nyata. */
window.MBSeed = (() => {
  const today = () => new Date().toISOString().slice(0,10);
  const names = ['Aditya Pranata','Nadia Maharani','Dimas Saputra','Rani Anggraini','Fajar Ramadhan','Putri Lestari','Bagas Wibowo','Anisa Kirana','Rizky Firmansyah','Salsa Amelia','Gilang Perkasa','Tiara Andini','Bima Nugraha','Alya Syafira','Reza Maulana','Nabila Rahma','Arga Prasetyo','Nayla Putri','Iqbal Mahendra','Zahra Nuraini'];
  const users = [
    {id:'USR-001',name:'Administrator Milala',email:'admin@milala.demo',password:'Admin123!',role:'admin',branch:'CB-001',active:true},
    {id:'USR-002',name:'Nisa Customer Service',email:'cs@milala.demo',password:'Cs12345!',role:'cs',branch:'CB-001',active:true},
    {id:'USR-003',name:'Bima Teller',email:'teller@milala.demo',password:'Teller123!',role:'teller',branch:'CB-001',active:true},
    {id:'USR-004',name:'Ratih Manajer',email:'manager@milala.demo',password:'Manager123!',role:'manager',branch:'CB-001',active:true},
    {id:'USR-005',name:'Dewi Auditor',email:'auditor@milala.demo',password:'Auditor123!',role:'auditor',branch:'CB-001',active:true}
  ];
  const branches = [
    {id:'CB-001',code:'PST',name:'Milala Kantor Pusat',city:'Jakarta',address:'Jl. Contoh No. 1, Jakarta',active:true},
    {id:'CB-002',code:'SBY',name:'Milala Cabang Surabaya',city:'Surabaya',address:'Jl. Ilustrasi No. 2, Surabaya',active:true},
    {id:'CB-003',code:'BDG',name:'Milala Cabang Bandung',city:'Bandung',address:'Jl. Simulasi No. 3, Bandung',active:true}
  ];
  function create(){
    const customers = names.map((name,i)=>({id:`NSB-${String(i+1).padStart(4,'0')}`,name,identity:`DEMO-KYC-${String(i+1).padStart(4,'0')}`,email:`nasabah${i+1}@example.test`,phone:`0800-000-${String(i+1).padStart(4,'0')}`,address:['Jakarta','Surabaya','Bandung'][i%3],occupation:['Karyawan','Wiraswasta','Pelajar'][i%3],branch:branches[i%3].id,status:'Aktif',createdAt:`2026-0${(i%8)+1}-${String((i%25)+1).padStart(2,'0')}`}));
    const accounts=[];
    customers.forEach((c,i)=>{
      accounts.push({id:`ACC-${String(i+1).padStart(4,'0')}`,number:`ML-${String(1000000001+i)}`,customerId:c.id,product:i%4===0?'Giro':'Tabungan',branch:c.branch,status:'Aktif',openedAt:c.createdAt});
      if(i<6) accounts.push({id:`ACC-${String(21+i).padStart(4,'0')}`,number:`ML-${String(1000000021+i)}`,customerId:c.id,product:'Tabungan',branch:c.branch,status:'Aktif',openedAt:c.createdAt});
    });
    const state={version:1,users:structuredClone(users),branches:structuredClone(branches),customers,accounts,transactions:[],journal:[],loans:[],audit:[],settings:{bankName:'MILALA BANK',institution:'PT Bank Milala (Fiktif / Demo)',currency:'IDR',theme:'light',requireLoanApproval:true},counters:{customer:21,account:27,transaction:1,loan:1,log:1}};
    function post(kind,from,to,amount,description,date,user='USR-001'){
      const id=`TRX-${String(state.counters.transaction++).padStart(6,'0')}`;
      const stamp=`${date}T10:${String(state.counters.transaction%60).padStart(2,'0')}:00`;
      const tx={id,type:kind,from,to,amount,description,date:stamp,actor:user,status:'Berhasil'};
      state.transactions.push(tx);
      state.journal.push({id:`J-${id}-D`,transactionId:id,account:from,delta:-amount,date:stamp});
      state.journal.push({id:`J-${id}-C`,transactionId:id,account:to,delta:amount,date:stamp});
    }
    accounts.forEach((a,i)=>post('Setor Tunai','GL-CASH',a.id,(1200000+(i%8)*735000),'Saldo awal demo',a.openedAt));
    for(let i=0;i<85;i++){
      const a=accounts[i%accounts.length], b=accounts[(i+7)%accounts.length];
      const d=`2026-${String(5+(i%6)).padStart(2,'0')}-${String(1+(i%19)).padStart(2,'0')}`;
      if(i%3===0) post('Setor Tunai','GL-CASH',a.id,200000+(i%10)*95000,'Setoran simulasi',d,'USR-003');
      else if(i%3===1) post('Transfer Internal',a.id,b.id,35000+(i%6)*15000,'Transfer antar rekening simulasi',d,'USR-003');
      else post('Tarik Tunai',a.id,'GL-CASH',25000+(i%7)*10000,'Penarikan tunai simulasi',d,'USR-003');
    }
    for(let i=0;i<10;i++){
      const c=customers[i];const val=3000000+i*650000;
      const loanId=`LN-${String(i+1).padStart(4,'0')}`;
      const acct=accounts.find(a=>a.customerId===c.id).id;
      const date=`2026-09-${String(5+i).padStart(2,'0')}`;
      const status=i<4?'Menunggu Persetujuan':i<7?'Disetujui':i<9?'Lunas':'Ditolak';
      if(status==='Disetujui'||status==='Lunas'){
        post('Pencairan Kredit','GL-LOANFUND',acct,val,`Pencairan kredit demo ${loanId}`,date,'USR-004');
        if(status==='Lunas')post('Angsuran Pokok',acct,'GL-LOANFUND',val,`Pelunasan pokok demo ${loanId}`,`2026-10-${String(10+i).padStart(2,'0')}`,'USR-003');
      }
      state.loans.push({id:loanId,customerId:c.id,accountId:acct,product:i%2?'Kredit Usaha':'Kredit Multiguna',principal:val,outstanding:status==='Disetujui'?val:0,rate:8+(i%4),term:12+(i%3)*12,status,date,approvedBy:status==='Menunggu Persetujuan'?null:'USR-004',approvedAt:status==='Menunggu Persetujuan'?null:`${date}T14:00:00`});
    }
    state.counters.loan=11;
    state.audit=[{id:'LOG-0001',date:new Date().toISOString(),actor:'SISTEM',action:'SEED',module:'Sistem',description:'Data simulasi awal dibuat'}];
    state.counters.log=2;
    return state;
  }
  return {create,today};
})();
