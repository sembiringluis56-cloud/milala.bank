window.MBStore=(()=>{
  const PATH='milala_core_banking';
  const LISTS=['users','branches','customers','accounts','transactions','journal','loans','audit'];
  let cache=null, ref=null;
  const deepCopy=o=>JSON.parse(JSON.stringify(o));

  const validate=s=>s&&typeof s==='object'&&s.version===1&&Array.isArray(s.users)&&Array.isArray(s.accounts)&&Array.isArray(s.customers)&&Array.isArray(s.transactions)&&Array.isArray(s.journal)&&Array.isArray(s.loans)&&Array.isArray(s.audit)&&Array.isArray(s.branches)&&s.settings&&s.counters;

  // RTDB membuang array kosong & nilai null, dan bisa mengembalikan array sebagai objek.
  function normalize(s){
    if(!s||typeof s!=='object')return null;
    LISTS.forEach(k=>{
      const v=s[k];
      s[k]=Array.isArray(v)?v.filter(x=>x!=null):(v&&typeof v==='object'?Object.values(v):[]);
    });
    return s;
  }

  // Dipanggil sekali saat aplikasi start. Mengembalikan Promise.
  function init(){
    if(!window.firebase)return Promise.reject(new Error('Firebase SDK gagal dimuat. Periksa koneksi internet.'));
    if(!firebase.apps.length)firebase.initializeApp(window.FIREBASE_CONFIG);
    ref=firebase.database().ref(PATH);
    return ref.once('value').then(snap=>{
      if(!snap.exists()){            // database masih kosong -> isi data seed
        const seeded=window.MBSeed.create();
        cache=seeded;
        return write(seeded);
      }
      const data=normalize(snap.val());
      if(!validate(data))throw new Error('Struktur data di Firebase tidak valid.');
      cache=data;
    });
  }

  function write(value){
    return ref.set(deepCopy(value)).catch(e=>{
      console.error('Gagal menyimpan ke Firebase:',e);
      alert('Gagal menyimpan ke cloud: '+e.message);
    });
  }

  function read(){
    if(!cache)throw new Error('Data belum dimuat dari Firebase.');
    return deepCopy(cache);
  }
  function save(value){
    if(!validate(value))throw new Error('Struktur data tidak valid.');
    cache=deepCopy(value);
    write(cache);               // async di belakang layar
  }

  function balance(state,accountId){return state.journal.reduce((sum,e)=>sum+(e.account===accountId?e.delta:0),0);}
  function commit(mutator){const next=read();mutator(next);save(next);return deepCopy(next);}
  function reset(){const s=window.MBSeed.create();save(s);return s;}

  function validateImport(s){
    if(!validate(s)||s.users.length>10000||s.transactions.length>200000||s.journal.length>400000)throw new Error('Format backup tidak cocok atau terlalu besar.');
    if(s.journal.some(e=>!Number.isSafeInteger(e.delta)||typeof e.account!=='string'))throw new Error('Jurnal tidak valid.');
    const counts=new Map();for(const e of s.journal)counts.set(e.transactionId,(counts.get(e.transactionId)||0)+e.delta);
    if([...counts.values()].some(v=>v!==0))throw new Error('Jurnal backup tidak seimbang.');
    if(s.accounts.some(a=>!a.id||!a.number)||new Set(s.accounts.map(a=>a.number)).size!==s.accounts.length)throw new Error('Nomor rekening duplikat atau tidak valid.');
    if(s.transactions.some(t=>!Number.isSafeInteger(t.amount)||t.amount<=0))throw new Error('Nilai transaksi backup tidak valid.');
    return true;
  }
  function importData(s){validateImport(s);save(s);}

  return {init,read,save,commit,balance,reset,validateImport,importData};
})();