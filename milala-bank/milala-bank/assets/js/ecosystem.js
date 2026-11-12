/*
 * MILALA BANK Smart Finance extension: opt-in personal finance workspace.
 * No real bank connections, transfers, AI provider calls, or changes to bank ledger.
 * All workspace data persists on the existing trusted API under the signed-in UID.
 */
window.MBEco = (() => {
  'use strict';
  const store = window.MBStore;
  const names = [
    ['eco-dashboard', 'smartDashboard', 'grid'],
    ['eco-assistant', 'assistant', 'spark'],
    ['eco-analytics', 'analytics', 'chart'],
    ['eco-banks', 'multiBank', 'wallet'],
    ['eco-goals', 'goals', 'target'],
    ['eco-invoices', 'invoices', 'list'],
    ['eco-business', 'business', 'building'],
    ['eco-security', 'security', 'shield'],
    ['eco-reports', 'financeReports', 'book'],
    ['eco-family', 'family', 'users'],
    ['eco-feedback', 'feedback', 'message']
  ];
  const dict = {
    id: {
      smartDashboard:'Dashboard Keuangan', assistant:'AI Assistant',analytics:'Analisis Keuangan',multiBank:'Multi-Bank',goals:'Target Tabungan',invoices:'Invoice & Tagihan',business:'Manajemen Bisnis',security:'Security Center',financeReports:'Laporan Keuangan',family:'Family Finance',feedback:'Feedback',feedbackInbox:'Feedback Masuk',
      financeIntro:'Pusat keuangan pribadi dan bisnis • fitur tambahan MILALA BANK',personalFinance:'Keuangan pribadi',internalAccounts:'Rekening MILALA (simulasi)',externalAccounts:'Saldo bank eksternal (manual)',income:'Pemasukan',expense:'Pengeluaran',net:'Selisih',total:'Total',transaction:'Transaksi',recent:'Aktivitas terbaru',noData:'Belum ada data.',add:'Tambah',edit:'Ubah',delete:'Hapus',save:'Simpan',cancel:'Batal',name:'Nama',notes:'Catatan',amount:'Nominal (Rp)',date:'Tanggal',type:'Jenis',status:'Status',category:'Kategori',title:'Judul',description:'Keterangan',party:'Pelanggan / pemasok',due:'Jatuh tempo',balance:'Saldo manual (Rp)',bank:'Nama bank',accountType:'Jenis akun',target:'Target (Rp)',saved:'Terkumpul (Rp)',progress:'Kemajuan',saveGoal:'Tambahkan tabungan',contribution:'Nominal alokasi (Rp)',confirmDelete:'Hapus data ini?',success:'Data berhasil disimpan.',deleted:'Data berhasil dihapus.',refreshed:'Data diperbarui.',filterAll:'Semua',credit:'Pemasukan',debit:'Pengeluaran',paid:'Lunas',unpaid:'Belum lunas',incomeInvoice:'Invoice masuk',outgoingInvoice:'Tagihan keluar',
      dashboardDesc:'Ringkasan keuangan dari rekening simulasi dan catatan manual milikmu.',assistantDesc:'Tanyakan tentang pemasukan, pengeluaran, tabungan, dan kondisi keuanganmu.',assistantDisclaimer:'Asisten ini menggunakan aturan lokal dan data simulasi/manual. Belum terhubung ke model AI generatif.',assistantPrompt:'Contoh: Bagaimana kondisi keuangan saya? Apa target tabungan saya?',ask:'Tanya asisten',assistantWelcome:'Coba tanyakan saldo, pengeluaran, target tabungan, atau tagihan.',analyticsDesc:'Lihat arus kas dari transaksi manual dalam enam bulan terakhir.',banksDesc:'Catat saldo akun eksternal secara manual. Tidak ada koneksi atau transfer ke bank lain.',bankCaution:'Saldo bank eksternal adalah catatan yang kamu masukkan sendiri, bukan saldo yang diverifikasi bank.',goalDesc:'Atur target, pantau progres, dan catat alokasi tabungan tanpa memindahkan uang asli.',invoiceDesc:'Catat invoice dan tagihan, pantau jatuh tempo, tandai pembayaran secara manual.',businessDesc:'Catat pemasukan dan pengeluaran bisnis simulasi.',securityDesc:'Kelola keamanan akun Firebase yang sudah ada. Data fitur tambahan hanya dapat diakses akunmu.',reportsDesc:'Unduh rekap keuangan simulasi dan catatan manual sebagai CSV.',familyDesc:'Buat daftar anggota dan anggaran keluarga manual. Belum ada undangan atau sinkronisasi ke akun lain.',feedbackDesc:'Sampaikan saran, masalah, atau apresiasi untuk pengembang.',feedbackInboxDesc:'Seratus feedback terbaru dari pengunjung dan pengguna.',noneFound:'Tidak ada catatan untuk ditampilkan.',sampleQuestions:'Contoh pertanyaan',reportExport:'Unduh laporan CSV',businessExport:'Unduh buku kas CSV',familyMembers:'Anggota keluarga',familyBudgets:'Anggaran keluarga',budget:'Batas anggaran (Rp)',spent:'Terpakai (Rp)',role:'Peran',noGoals:'Belum ada target tabungan',noBills:'Belum ada invoice atau tagihan',noBanks:'Belum ada bank eksternal',scope:'Konteks',personal:'Pribadi',work:'Bisnis',overview:'Ringkasan',trend:'Tren kas',cashflow:'Arus kas',financialInfo:'Data keuangan merupakan simulasi dan pencatatan pribadi, bukan transaksi bank sungguhan.',formHint:'Perubahan tersimpan aman melalui API dan tidak menyentuh saldo/rekening utama.',lastUpdate:'Pembaruan terakhir',activeAccounts:'Rekening aktif',markPaid:'Tandai lunas',markUnpaid:'Belum lunas',overdue:'Lewat jatuh tempo',upcoming:'Akan jatuh tempo',quickActions:'Aksi cepat',expenseRatio:'Rasio pengeluaran',securityAuth:'Autentikasi Firebase',securityWorkspace:'Data terisolasi per akun',securityInfo:'Gunakan password unik. Jangan memasukkan rekening bank, dokumen identitas, atau detail finansial asli pada demo.',passwordCurrent:'Password saat ini',passwordNew:'Password baru (min. 12 karakter)',passwordConfirm:'Ulangi password baru',changePassword:'Ganti password',passwordChanged:'Password berhasil diperbarui.',submit:'Kirim feedback',suggestion:'Saran',bug:'Laporan bug',praise:'Apresiasi',email:'Email (opsional)',feedbackMessage:'Pesan (minimal 10 karakter)',feedbackSuccess:'Terima kasih! Feedback berhasil dikirim.',refresh:'Perbarui',send:'Kirim',publicHome:'Kembali ke beranda',language:'Bahasa',saveAllocation:'Catat alokasi',insufficientInfo:'Tambahkan catatan keuangan atau target tabungan untuk analisis lebih rinci.',loadError:'Fitur tambahan gagal memuat. Periksa deployment API.',retry:'Coba lagi',accountReadOnly:'Saldo rekening MILALA hanya dibaca dari jurnal bank. Tidak dapat diubah melalui fitur tambahan.',unknown:'Tidak diketahui',
      aiBalance:'Dari data yang tersedia, total saldo rekening simulasi dan saldo bank eksternal manual adalah',aiExpense:'Total pengeluaran yang kamu catat adalah',aiIncome:'Total pemasukan yang kamu catat adalah',aiGoals:'Kamu memiliki target tabungan sejumlah',aiInvoices:'Jumlah tagihan yang belum lunas adalah',aiAdvice:'Catat transaksi rutin, prioritaskan kebutuhan pokok, dan tinjau tujuan tabungan secara berkala.',aiCannot:'Aku bisa membantu menganalisis saldo, pemasukan, pengeluaran, target tabungan, atau tagihan berdasarkan data yang kamu catat.',emptyData:'Belum ada pencatatan untuk dianalisis.',staffOnly:'Hanya admin dan manajer yang dapat melihat kotak feedback.'
    },
    en: {
      smartDashboard:'Finance Dashboard',assistant:'AI Assistant',analytics:'Financial Analytics',multiBank:'Multi-Bank',goals:'Savings Goals',invoices:'Invoices & Bills',business:'Business Management',security:'Security Center',financeReports:'Financial Reports',family:'Family Finance',feedback:'Feedback',feedbackInbox:'Incoming Feedback',financeIntro:'Personal & business finance hub • MILALA BANK add-on',personalFinance:'Personal finance',internalAccounts:'MILALA accounts (simulation)',externalAccounts:'External bank balances (manual)',income:'Income',expense:'Expenses',net:'Net',total:'Total',transaction:'Transaction',recent:'Recent activity',noData:'No data available.',add:'Add',edit:'Edit',delete:'Delete',save:'Save',cancel:'Cancel',name:'Name',notes:'Notes',amount:'Amount (IDR)',date:'Date',type:'Type',status:'Status',category:'Category',title:'Title',description:'Description',party:'Customer / vendor',due:'Due date',balance:'Manual balance (IDR)',bank:'Bank name',accountType:'Account type',target:'Goal amount (IDR)',saved:'Saved amount (IDR)',progress:'Progress',saveGoal:'Add savings',contribution:'Allocation amount (IDR)',confirmDelete:'Delete this record?',success:'Saved successfully.',deleted:'Deleted successfully.',refreshed:'Data refreshed.',filterAll:'All',credit:'Income',debit:'Expense',paid:'Paid',unpaid:'Unpaid',incomeInvoice:'Receivable invoice',outgoingInvoice:'Bill payable',dashboardDesc:'Financial overview from your simulated accounts and personal records.',assistantDesc:'Ask about income, spending, savings, and your finances.',assistantDisclaimer:'This assistant uses local rules and simulated/manual data. A generative AI provider is not connected.',assistantPrompt:'Example: How are my finances? What are my savings goals?',ask:'Ask assistant',assistantWelcome:'Ask about balances, expenses, savings goals, or bills.',analyticsDesc:'Track cash flow from manual entries in the past six months.',banksDesc:'Track external accounts manually. No connection or transfers to other banks.',bankCaution:'External bank balances are user-entered notes, not bank-verified balances.',goalDesc:'Set goals, track progress, and log savings without moving real money.',invoiceDesc:'Record bills and invoices, follow due dates, and manually mark payments.',businessDesc:'Track simulated business income and expenses.',securityDesc:'Manage your existing Firebase account security. Added data is accessible only to your account.',reportsDesc:'Export simulated finance and manual records to CSV.',familyDesc:'Manually manage family members and budgets. Invites and cross-account syncing are not available.',feedbackDesc:'Share suggestions, issues, or compliments with the developer.',feedbackInboxDesc:'The latest 100 feedback messages from visitors and users.',noneFound:'No records to show.',sampleQuestions:'Example questions',reportExport:'Download CSV report',businessExport:'Download cashbook CSV',familyMembers:'Family members',familyBudgets:'Family budgets',budget:'Budget limit (IDR)',spent:'Spent (IDR)',role:'Role',noGoals:'No savings goals',noBills:'No bills or invoices',noBanks:'No external banks',scope:'Scope',personal:'Personal',work:'Business',overview:'Overview',trend:'Cash trend',cashflow:'Cash flow',financialInfo:'Financial data is simulated or manually recorded and is not a real banking transaction.',formHint:'Changes are securely saved through the API and do not affect the main banking ledger.',lastUpdate:'Last updated',activeAccounts:'Active accounts',markPaid:'Mark paid',markUnpaid:'Unpaid',overdue:'Overdue',upcoming:'Due soon',quickActions:'Quick actions',expenseRatio:'Expense ratio',securityAuth:'Firebase authentication',securityWorkspace:'Account-isolated data',securityInfo:'Use a unique password. Do not enter real banking credentials, identity documents, or sensitive financial information in this demo.',passwordCurrent:'Current password',passwordNew:'New password (min. 12 characters)',passwordConfirm:'Confirm new password',changePassword:'Change password',passwordChanged:'Password updated.',submit:'Send feedback',suggestion:'Suggestion',bug:'Bug report',praise:'Compliment',email:'Email (optional)',feedbackMessage:'Message (at least 10 characters)',feedbackSuccess:'Thank you! Your feedback has been sent.',refresh:'Refresh',send:'Send',publicHome:'Back to homepage',language:'Language',saveAllocation:'Record allocation',insufficientInfo:'Add financial records or savings goals for more detailed analysis.',loadError:'Add-on failed to load. Check API deployment.',retry:'Try again',accountReadOnly:'MILALA balances are read from the bank journal and cannot be changed in this add-on.',unknown:'Unknown',aiBalance:'Based on available data, combined simulated MILALA and manually entered external balances are',aiExpense:'Your recorded total expenses are',aiIncome:'Your recorded total income is',aiGoals:'Your total savings goal is',aiInvoices:'Your unpaid invoices and bills total',aiAdvice:'Track spending regularly, prioritize essentials, and revisit your savings goals.',aiCannot:'I can analyze balances, income, spending, savings goals, and bills based on your entries.',emptyData:'There are no records to analyze yet.',staffOnly:'Only admins and managers can view feedback inbox.'
    },
    zh: {
      smartDashboard:'财务仪表盘',assistant:'智能财务助手',analytics:'财务分析',multiBank:'多银行管理',goals:'储蓄目标',invoices:'发票与账单',business:'业务管理',security:'安全中心',financeReports:'财务报告',family:'家庭财务',feedback:'意见反馈',feedbackInbox:'收到的反馈',financeIntro:'个人与企业财务中心 • MILALA BANK 扩展功能',personalFinance:'个人财务',internalAccounts:'MILALA 账户（模拟）',externalAccounts:'外部银行余额（手动）',income:'收入',expense:'支出',net:'结余',total:'合计',transaction:'交易',recent:'近期活动',noData:'暂无数据。',add:'添加',edit:'编辑',delete:'删除',save:'保存',cancel:'取消',name:'姓名／名称',notes:'备注',amount:'金额（印尼盾）',date:'日期',type:'类型',status:'状态',category:'类别',title:'标题',description:'描述',party:'客户／供应商',due:'到期日',balance:'手动余额（印尼盾）',bank:'银行名称',accountType:'账户类型',target:'目标金额（印尼盾）',saved:'已储蓄（印尼盾）',progress:'进度',saveGoal:'增加储蓄',contribution:'分配金额（印尼盾）',confirmDelete:'确定删除这条记录？',success:'保存成功。',deleted:'删除成功。',refreshed:'数据已更新。',filterAll:'全部',credit:'收入',debit:'支出',paid:'已付清',unpaid:'未付',incomeInvoice:'应收发票',outgoingInvoice:'应付账单',dashboardDesc:'基于模拟账户和手动记录的财务概览。',assistantDesc:'询问收入、支出、储蓄和个人财务状况。',assistantDisclaimer:'该助手仅使用本地规则和模拟／手动数据，尚未连接生成式 AI 服务。',assistantPrompt:'例如：我的财务状况如何？我的储蓄目标是什么？',ask:'询问助手',assistantWelcome:'可以询问余额、支出、储蓄目标或账单。',analyticsDesc:'查看最近六个月手动录入的现金流。',banksDesc:'手动记录外部银行账户，不连接银行也不能转账。',bankCaution:'外部银行余额是个人手动记录，未经银行核实。',goalDesc:'设置储蓄目标、追踪进度，记录分配金额，不涉及真实资金。',invoiceDesc:'记录发票和账单、跟踪到期日并手动标记付款。',businessDesc:'记录模拟业务收入和支出。',securityDesc:'管理现有 Firebase 账户安全，新增数据仅本人可访问。',reportsDesc:'将模拟财务和手动记录导出为 CSV。',familyDesc:'手动管理家庭成员和预算，暂不支持邀请和跨账号同步。',feedbackDesc:'向开发者提交建议、问题或表扬。',feedbackInboxDesc:'来自访客和用户的最近 100 条反馈。',noneFound:'暂无记录。',sampleQuestions:'问题示例',reportExport:'下载 CSV 报告',businessExport:'下载账簿 CSV',familyMembers:'家庭成员',familyBudgets:'家庭预算',budget:'预算上限（印尼盾）',spent:'已使用（印尼盾）',role:'角色',noGoals:'暂无储蓄目标',noBills:'暂无发票或账单',noBanks:'暂无外部银行',scope:'范围',personal:'个人',work:'业务',overview:'概览',trend:'现金流趋势',cashflow:'现金流',financialInfo:'所有财务数据仅供模拟或手动记录，不是真实银行交易。',formHint:'数据通过安全 API 保存，不会修改核心银行账户或账本。',lastUpdate:'最近更新',activeAccounts:'有效账户',markPaid:'标记已付',markUnpaid:'未付',overdue:'已逾期',upcoming:'即将到期',quickActions:'快捷操作',expenseRatio:'支出比例',securityAuth:'Firebase 身份验证',securityWorkspace:'独立账户数据',securityInfo:'请使用独立密码。勿在演示中输入真实银行凭据、身份证件或敏感财务信息。',passwordCurrent:'当前密码',passwordNew:'新密码（至少 12 个字符）',passwordConfirm:'确认新密码',changePassword:'修改密码',passwordChanged:'密码更新成功。',submit:'发送反馈',suggestion:'建议',bug:'错误报告',praise:'表扬',email:'邮箱（选填）',feedbackMessage:'留言（至少 10 个字符）',feedbackSuccess:'感谢你！反馈已成功提交。',refresh:'刷新',send:'发送',publicHome:'返回首页',language:'语言',saveAllocation:'记录分配',insufficientInfo:'添加财务记录或储蓄目标以获得更详细分析。',loadError:'无法加载扩展功能，请检查 API 部署。',retry:'重试',accountReadOnly:'MILALA 余额由银行账本提供，不能在扩展功能中修改。',unknown:'未知',aiBalance:'根据现有数据，模拟 MILALA 账户与手动外部银行余额合计为',aiExpense:'你记录的支出合计为',aiIncome:'你记录的收入合计为',aiGoals:'你的储蓄目标总额为',aiInvoices:'未支付的账单和发票合计为',aiAdvice:'定期记录支出、优先保障基本需求并检查储蓄目标。',aiCannot:'我可以根据你的记录分析余额、收入、支出、储蓄目标和账单。',emptyData:'暂无可分析的记录。',staffOnly:'只有管理员和经理可以查看反馈收件箱。'
    }
  };
  const legacyLabels = {
    'Dashboard':'Dashboard', 'Data Nasabah':'Customers','Rekening Nasabah':'Customer Accounts','Setor & Tarik Tunai':'Cash Deposit & Withdrawal','Transfer Internal':'Internal Transfer','Mutasi Rekening':'Account Statement','Manajemen Kredit':'Loan Management','Persetujuan Kredit':'Loan Approvals','Laporan Keuangan':'Financial Reports','Jurnal Transaksi':'Transaction Journal','Audit Log':'Audit Log','Manajemen Cabang':'Branch Management','Manajemen Pengguna':'User Management','Pengaturan Sistem':'System Settings','Profil Saya':'My Profile','Ringkasan':'Overview','Rekening Saya':'My Accounts','Riwayat Transaksi':'Transaction History','Pengajuan Kredit':'Loan Application','Masuk':'Sign In','Buka Rekening':'Open Account','Produk':'Products','Layanan':'Services','Tentang':'About','Admin':'Admin','Keluar':'Log Out','Perbarui':'Refresh','Mulai sekarang':'Get Started','Masuk nasabah':'Customer Sign In','Login Staf 👋':'Staff Sign In 👋','Email pengguna':'User Email','Password':'Password','Kembali ke website':'Back to website','Kembali ke beranda':'Back to homepage','PORTAL NASABAH':'CUSTOMER PORTAL','MENU NASABAH':'CUSTOMER MENU','MODE SIMULASI':'SIMULATION MODE','SIMULASI EDUKASI:':'EDUCATIONAL SIMULATION:', 'Selamat datang kembali.':'Welcome back.','Daftar rekening':'Account list','Riwayat transaksi':'Transaction history','Informasi profil':'Profile information','Status':'Status','Tanggal':'Date','Nominal':'Amount','Saldo':'Balance','Bergabung':'Joined','Nama':'Name','Email':'Email','Telepon':'Phone','Alamat':'Address','Cabang':'Branch','Akun aktif':'Active account','Nama lengkap':'Full name','Email aktif':'Active email','Ulangi password':'Confirm password','Simpan Password':'Save Password','Cari':'Search','Reset':'Reset','Batal':'Cancel','Simpan':'Save','Tambah':'Add','Baru':'New','Tidak ada data yang cocok':'No matching data', 'Pengaturan Sistem':'System Settings', 'Ubah tema':'Toggle theme'
  };
  const legacyZh = {'Dashboard':'仪表盘','Data Nasabah':'客户资料','Rekening Nasabah':'客户账户','Setor & Tarik Tunai':'存取款','Transfer Internal':'内部转账','Mutasi Rekening':'账户流水','Manajemen Kredit':'贷款管理','Persetujuan Kredit':'贷款审批','Laporan Keuangan':'财务报告','Jurnal Transaksi':'交易日记账','Audit Log':'审计日志','Manajemen Cabang':'分行管理','Manajemen Pengguna':'用户管理','Pengaturan Sistem':'系统设置','Profil Saya':'我的资料','Ringkasan':'概览','Rekening Saya':'我的账户','Riwayat Transaksi':'交易记录','Pengajuan Kredit':'贷款申请','Masuk':'登录','Buka Rekening':'开户','Produk':'产品','Layanan':'服务','Tentang':'关于','Admin':'管理员','Keluar':'退出','Perbarui':'刷新','Mulai sekarang':'立即开始','Masuk nasabah':'客户登录','Login Staf 👋':'员工登录 👋','Email pengguna':'用户邮箱','Password':'密码','Kembali ke website':'返回网站','Kembali ke beranda':'返回首页','PORTAL NASABAH':'客户门户','MENU NASABAH':'客户菜单','MODE SIMULASI':'模拟模式','SIMULASI EDUKASI:':'教育模拟：','Selamat datang kembali.':'欢迎回来。','Daftar rekening':'账户列表','Riwayat transaksi':'交易记录','Informasi profil':'个人资料','Status':'状态','Tanggal':'日期','Nominal':'金额','Saldo':'余额','Bergabung':'加入日期','Nama':'姓名','Email':'邮箱','Telepon':'电话','Alamat':'地址','Cabang':'分行','Akun aktif':'有效账户','Nama lengkap':'全名','Email aktif':'有效邮箱','Ulangi password':'确认密码','Simpan Password':'保存密码','Cari':'搜索','Reset':'重置','Batal':'取消','Simpan':'保存','Tambah':'添加','Baru':'新建','Tidak ada data yang cocok':'没有匹配的数据','Ubah tema':'切换主题'};
  Object.assign(legacyLabels,{
    'Atur keuanganmu.':'Manage your money.','Jalani hari':'Enjoy your days','lebih tenang.':'with peace of mind.',
    'PERBANKAN DIGITAL YANG LEBIH DEKAT':'DIGITAL BANKING WITHIN REACH','Akses portal personal':'Personal portal access','Responsif di semua perangkat':'Works across all devices',
    'Kenali layanan MILALA BANK melalui pengalaman digital yang praktis, informatif, dan mudah digunakan — dalam satu portal.':'Explore MILALA BANK through an easy, informative, and convenient digital experience — all in one portal.',
    'Selamat datang,':'Welcome,','Halaman utama':'Homepage','PORTAL NASABAH / RINGKASAN':'CUSTOMER PORTAL / OVERVIEW',
    'Senang melihatmu kembali. Ini ringkasan akun simulasi MILALA BANK.':'Welcome back. Here is your simulated MILALA BANK account overview.',
    'Total saldo simulasi':'Total simulated balance','Rekening terdaftar':'Registered accounts','Aktivitas transaksi':'Transactions','Pengajuan kredit':'Loan applications',
    'Tabungan virtual':'Virtual savings','Catatan di sistem demo':'Simulation records','Rekening utama':'Main accounts','Transaksi terbaru':'Recent transactions','Rekening aktif':'Active accounts',
    'Data nasabah':'Customer data','Pengaturan':'Settings','Rekening':'Account','Tampilkan':'Show','Unduh':'Download','Detail':'Details',
    'Rekening saya':'My accounts','Laporan':'Reports','Total Nasabah':'Total Customers','Dana Nasabah':'Customer Deposits','Rekening Aktif':'Active Accounts','Kredit Berjalan':'Outstanding Loans',
    'Dashboard Overview':'Dashboard Overview','Volume transaksi bulanan':'Monthly transaction volume','Aksi cepat':'Quick actions','Aktivitas terbaru':'Recent activity',
    'Nama Bank':'Bank name','Nama Institusi (Fiktif)':'Institution name (fictional)','Tema':'Theme','Simpan Pengaturan':'Save settings','Pengaturan persetujuan':'Approval settings',
    'Informasi akun':'Account information','ID Pengguna':'User ID','Password saat ini':'Current password','Password baru (min. 12 karakter)':'New password (min. 12 characters)',
    'Ulangi password baru':'Confirm new password','Kirim pengajuan':'Submit application','Buat pengajuan baru':'New application','Riwayat pengajuan':'Application history',
    'Rekening tujuan pencairan':'Disbursement account','Produk kredit':'Loan product','Nominal pengajuan (Rp)':'Requested amount (IDR)',
    'Informasi dasar yang digunakan pada akun simulasi.':'Basic information used by your simulation account.',
    'Masuk untuk melihat rekening virtual dan aktivitas akun simulasi MILALA BANK.':'Sign in to view your virtual accounts and simulated activity.',
    'Buat akun menggunakan email aktif. Rekening tabungan virtual dibuat setelah email terverifikasi.':'Create an account with an active email. A virtual savings account will be created after verification.',
    'Buat Akun Nasabah':'Create customer account','Daftar nasabah':'Register','Sudah punya akun?':'Have an account?','Belum punya akun?':'New here?',
    'Lupa password?':'Forgot password?','Email terdaftar':'Registered email','Password akun':'Account password','Masuk ke Portal Nasabah':'Sign in to customer portal',
    'REGISTRASI NASABAH':'CUSTOMER REGISTRATION','VERIFIKASI EMAIL':'EMAIL VERIFICATION','Satu langkah lagi.':'One more step.',
    'Kirim ulang email':'Resend email','Saya sudah verifikasi':'I verified my email','Kembali ke website':'Back to website',
    'Buat pengajuan baru':'New application','Tunggu persetujuan':'Pending approval','Profil Pengguna':'User Profile','Informasi profil':'Profile information'
  });
  Object.assign(legacyZh,{
    'Atur keuanganmu.':'管理你的财务。','Jalani hari':'轻松享受','lebih tenang.':'每一天。',
    'PERBANKAN DIGITAL YANG LEBIH DEKAT':'触手可及的数字银行','Akses portal personal':'个人门户','Responsif di semua perangkat':'适配所有设备',
    'Kenali layanan MILALA BANK melalui pengalaman digital yang praktis, informatif, dan mudah digunakan — dalam satu portal.':'在一个便捷、直观的数字门户中探索 MILALA BANK 服务。',
    'PORTAL NASABAH / RINGKASAN':'客户门户／概览','Senang melihatmu kembali. Ini ringkasan akun simulasi MILALA BANK.':'欢迎回来！以下是你的 MILALA BANK 模拟账户概览。',
    'Total saldo simulasi':'模拟余额合计','Rekening terdaftar':'已注册账户','Aktivitas transaksi':'交易活动','Pengajuan kredit':'贷款申请','Tabungan virtual':'虚拟储蓄',
    'Catatan di sistem demo':'模拟系统记录','Rekening utama':'主要账户','Transaksi terbaru':'最近交易','Rekening aktif':'有效账户',
    'Dashboard Overview':'仪表盘概览','Volume transaksi bulanan':'每月交易量','Aksi cepat':'快捷操作','Aktivitas terbaru':'最近活动',
    'Total Nasabah':'客户总数','Dana Nasabah':'客户存款','Rekening Aktif':'有效账户','Kredit Berjalan':'未还贷款',
    'Nama Bank':'银行名称','Nama Institusi (Fiktif)':'机构名称（虚构）','Tema':'主题','Simpan Pengaturan':'保存设置','Pengaturan persetujuan':'审批设置',
    'Informasi akun':'账户信息','ID Pengguna':'用户编号','Password saat ini':'当前密码','Password baru (min. 12 karakter)':'新密码（至少12位）',
    'Ulangi password baru':'确认新密码','Kirim pengajuan':'提交申请','Buat pengajuan baru':'新申请','Riwayat pengajuan':'申请记录',
    'Rekening tujuan pencairan':'放款账户','Produk kredit':'贷款产品','Nominal pengajuan (Rp)':'申请金额（印尼盾）',
    'Informasi dasar yang digunakan pada akun simulasi.':'模拟账户使用的基本信息。',
    'Masuk untuk melihat rekening virtual dan aktivitas akun simulasi MILALA BANK.':'登录查看 MILALA BANK 模拟账户和活动。',
    'Buat akun menggunakan email aktif. Rekening tabungan virtual dibuat setelah email terverifikasi.':'使用有效邮箱注册。验证后将创建虚拟储蓄账户。',
    'Buat Akun Nasabah':'创建客户账户','Daftar nasabah':'注册','Sudah punya akun?':'已有账号？','Belum punya akun?':'还没有账号？','Lupa password?':'忘记密码？',
    'Email terdaftar':'注册邮箱','Password akun':'账号密码','Masuk ke Portal Nasabah':'登录客户门户','REGISTRASI NASABAH':'客户注册',
    'VERIFIKASI EMAIL':'邮箱验证','Satu langkah lagi.':'还差一步。','Kirim ulang email':'重发邮件','Saya sudah verifikasi':'我已验证','Kembali ke website':'返回网站'
  });
  let locale = 'id';
  try { locale = ['id','en','zh'].includes(localStorage.getItem('milala-language')) ? localStorage.getItem('milala-language') : 'id'; } catch (_) {}
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
  const t = (key) => dict[locale]?.[key] || dict.id[key] || key;
  const html = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const currency = (n) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(Number(n)||0);
  const fmtDate = (s) => s ? new Date(`${s}T00:00:00`).toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'id-ID') : '—';
  const today = () => new Date().toLocaleDateString('en-CA');
  const fields = ['banks','goals','invoices','entries','familyMembers','familyBudgets'];
  const blank = () => ({version:1,revision:0,banks:[],goals:[],invoices:[],entries:[],familyMembers:[],familyBudgets:[]});
  let data = blank(), loadPromise=null, loaded=false, error='', editing=null, answer='', inbox=[], inboxLoading=false, inboxLoaded=false, generation=0, onChange=()=>{};
  const read = () => data;
  const sum = (items,key) => items.reduce((n,i) => n+Number(i[key]||0),0);
  const entries = (type,scope) => data.entries.filter((i)=> (!type||i.type===type)&&(!scope||i.scope===scope));
  const icon = (name) => ({grid:'▦',spark:'✦',chart:'▥',wallet:'▣',target:'◎',list:'☷',building:'▤',shield:'⬡',book:'▧',users:'♧',message:'✉'}[name]||'•');
  const button = (action,text,id='',kind='ghost') => `<button type="button" class="eco-btn eco-${kind}" data-act="${html(action)}" data-id="${html(id)}">${text}</button>`;
  const tag = (label,val,unit='') => `<div class="eco-stat"><span>${html(label)}</span><strong>${val}</strong><small>${unit}</small></div>`;
  const el = (label,name,value='',type='text',opts='') => `<label class="eco-field"><span>${html(label)}</span><input class="input" type="${type}" name="${html(name)}" value="${html(value)}" ${opts}></label>`;
  const choose = (label,name,options,value='') => `<label class="eco-field"><span>${html(label)}</span><select class="select" name="${html(name)}">${options.map(([v,n])=>`<option value="${html(v)}" ${String(v)===String(value)?'selected':''}>${html(n)}</option>`).join('')}</select></label>`;
  const options = (vals) => vals.map(v=>[v,v]);
  const noteInput = (value='')=>`<label class="eco-field eco-full"><span>${t('notes')}</span><textarea class="textarea" name="note" maxlength="500">${html(value)}</textarea></label>`;
  const footer = () => `<div class="eco-disclaimer">ⓘ ${t('financialInfo')}</div>`;
  const layout = (name,description,content) => `<section class="eco-root"><div class="eco-heading"><div><div class="eco-eyebrow">SMART FINANCE ECOSYSTEM</div><h1>${t(name)}</h1><p>${t(description)}</p></div><div class="eco-lang-caption">${t('language')}: ${locale.toUpperCase()}</div></div>${content}${footer()}</section>`;
  const langSwitch = () => `<label class="eco-lang" aria-label="${t('language')}"><span>🌐</span><select aria-label="${t('language')}" data-eco-lang><option value="id" ${locale==='id'?'selected':''}>Indonesia</option><option value="en" ${locale==='en'?'selected':''}>English</option><option value="zh" ${locale==='zh'?'selected':''}>中文</option></select></label>`;
  const nav = () => names.map(([id,key,ic])=>[id,ic,t(key)]);
  const newId = () => 'fin_'+(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g,'') : `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const limitNum = (v) => { const n=Number(v); if(!Number.isSafeInteger(n)||n<0||n>10000000000)throw new Error(t('amount')+' (0 – 10.000.000.000)');return n; };
  const required = (v) => {const s=String(v||'').trim();if(!s)throw new Error(t('name')+' / '+t('title'));return s;};

  async function ensureLoaded(){
    if(loaded)return data;
    if(loadPromise)return loadPromise;
    const currentGeneration=generation;
    loadPromise=store.getFinanceWorkspace().then((out)=>{if(generation!==currentGeneration)return data;data={...blank(),...(out.workspace||{})};loaded=true;error='';onChange();return data;}).catch((err)=>{if(generation===currentGeneration){error=err.message||t('loadError');onChange();}throw err;}).finally(()=>{if(generation===currentGeneration)loadPromise=null;});
    return loadPromise;
  }
  function reset(){generation++;data=blank();loaded=false;loadPromise=null;editing=null;answer='';error='';inbox=[];inboxLoading=false;inboxLoaded=false;}
  async function save(next){
    const out=await store.saveFinanceWorkspace(next,data.revision);
    data={...blank(),...out.workspace};editing=null;onChange();return data;
  }
  async function mutate(fn){await ensureLoaded();const next=JSON.parse(JSON.stringify(data));fn(next);try{await save(next);}catch(err){if(String(err.code||'').includes('aborted')){loaded=false;await ensureLoaded().catch(()=>{});}throw err;}}
  const records = (field) => data[field]||[];
  const actions = (field) => `<div class="eco-panel-actions">${button('eco-new',`+ ${t('add')}`,field,'primary')}</div>`;
  const itemBtns=(field,id)=>`<div class="eco-item-actions">${button('eco-edit',t('edit'),field+':'+id)}${button('eco-delete',t('delete'),field+':'+id,'danger')}</div>`;
  const formatInput = (kind, current) => {
    const x=current||{}, num=(label,key)=>el(t(label),key,x[key]??0,'number','min="0" max="10000000000" step="1" required');
    if(kind==='banks') return el(t('name'),'name',x.name||'','text','required maxlength="120"')+el(t('bank'),'bank',x.bank||'','text','required maxlength="120"')+choose(t('accountType'),'type',options(['Tabungan','Giro','E-Wallet','Lainnya']),x.type||'Tabungan')+num('balance','balance')+noteInput(x.note);
    if(kind==='goals') return el(t('title'),'name',x.name||'','text','required maxlength="120"')+num('target','target')+num('saved','saved')+noteInput(x.note);
    if(kind==='invoices') return el(t('title'),'title',x.title||'','text','required maxlength="120"')+el(t('party'),'party',x.party||'','text','maxlength="120"')+choose(t('type'),'type',[['income',t('incomeInvoice')],['expense',t('outgoingInvoice')]],x.type||'expense')+num('amount','amount')+el(t('due'),'due',x.due||today(),'date','required')+choose(t('status'),'status',[['unpaid',t('unpaid')],['paid',t('paid')]],x.status||'unpaid')+noteInput(x.note);
    if(kind==='entries') return el(t('title'),'title',x.title||'','text','required maxlength="120"')+choose(t('type'),'type',[['income',t('income')],['expense',t('expense')]],x.type||'expense')+choose(t('scope'),'scope',[['personal',t('personal')],['business',t('work')]],x.scope||'business')+el(t('category'),'category',x.category||'Operasional','text','maxlength="120" required')+num('amount','amount')+el(t('date'),'date',x.date||today(),'date','required')+noteInput(x.note);
    if(kind==='familyMembers')return el(t('name'),'name',x.name||'','text','required maxlength="120"')+el(t('role'),'role',x.role||'','text','maxlength="120" required');
    if(kind==='familyBudgets')return el(t('category'),'category',x.category||'','text','required maxlength="120"')+num('budget','limit')+num('spent','used')+noteInput(x.note);
    return '';
  };
  const entryForm = (kind) => {
    if(!editing||editing.kind!==kind)return '';
    const existing=records(kind).find(x=>x.id===editing.id);
    return `<form id="eco-record-form" data-eco-kind="${kind}" data-eco-id="${html(editing.id||'')}" class="eco-edit-form"><h3>${existing?t('edit'):t('add')}</h3><div class="eco-form-grid">${formatInput(kind,existing)}</div><div class="eco-form-actions"><button type="submit" class="eco-btn eco-primary">${t('save')}</button>${button('eco-cancel',t('cancel'))}</div><p class="eco-helper">${t('formHint')}</p></form>`;
  };
  const pbar = (value,max) => `<div class="eco-progress"><span style="width:${Math.max(0,Math.min(100,max>0?value/max*100:0))}%"></span></div>`;
  const accountList = (ctx) => {
    const bankAccounts=ctx.isCustomer?(ctx.state.accounts||[]):[];
    return bankAccounts.map(a=>`<div class="eco-line"><div><strong>${html(a.product)}</strong><small>${html(a.number)}</small></div><b>${currency(store.balance(ctx.state,a.id))}</b></div>`).join('')||`<div class="eco-empty">${t('noData')}</div>`;
  };
  const internalBalance = (ctx) => ctx.isCustomer ? (ctx.state.accounts||[]).filter(a=>a.status==='Aktif').reduce((n,a)=>n+store.balance(ctx.state,a.id),0):0;
  const billsTotal = () => sum(data.invoices.filter(i=>i.status!=='paid'&&i.type==='expense'),'amount');
  const recentEntries = (items) => items.sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8).map(x=>`<div class="eco-line"><div><strong>${html(x.title)}</strong><small>${html(x.category)} • ${fmtDate(x.date)}</small></div><b class="${x.type==='income'?'eco-positive':'eco-negative'}">${x.type==='income'?'+':'−'}${currency(x.amount)}</b></div>`).join('')||`<div class="eco-empty">${t('noData')}</div>`;
  function dashboard(ctx){
    const incoming=sum(entries('income'),'amount'),outgoing=sum(entries('expense'),'amount');
    return layout('smartDashboard','dashboardDesc',`<div class="eco-stats">${tag(t('internalAccounts'),currency(internalBalance(ctx)),t('activeAccounts'))}${tag(t('externalAccounts'),currency(sum(data.banks,'balance')),t('bankCaution'))}${tag(t('income'),currency(incoming))}${tag(t('expense'),currency(outgoing))}</div><div class="eco-cols"><section class="eco-panel"><div class="eco-panel-head"><h2>${t('internalAccounts')}</h2></div>${accountList(ctx)}<p class="eco-helper">${t('accountReadOnly')}</p></section><section class="eco-panel"><div class="eco-panel-head"><h2>${t('recent')}</h2></div>${recentEntries([...data.entries])}</section></div><div class="eco-cols"><section class="eco-panel"><h2>${t('goals')}</h2>${data.goals.slice(0,4).map(g=>`<div class="eco-goal-row"><div><strong>${html(g.name)}</strong><span>${currency(g.saved)} / ${currency(g.target)}</span></div>${pbar(g.saved,g.target)}</div>`).join('')||`<div class="eco-empty">${t('noGoals')}</div>`}</section><section class="eco-panel"><h2>${t('quickActions')}</h2><div class="eco-shortcuts">${[['eco-goals','goals'],['eco-banks','multiBank'],['eco-invoices','invoices'],['eco-business','business']].map(([id,key])=>button('eco-open',t(key),id)).join('')}</div></section></div>`);
  }
  function assistant(){return layout('assistant','assistantDesc',`<div class="eco-cols"><section class="eco-panel"><div class="eco-panel-head"><h2>✦ ${t('assistant')}</h2></div><div class="eco-assistant-answer" role="status">${html(answer||t('assistantWelcome'))}</div><form id="eco-assistant-form" class="eco-assistant-form"><label class="eco-field eco-full"><span>${t('ask')}</span><input name="question" class="input" placeholder="${html(t('assistantPrompt'))}" minlength="3" maxlength="400" required></label><button class="eco-btn eco-primary" type="submit">${t('send')}</button></form><p class="eco-helper">${t('assistantDisclaimer')}</p></section><section class="eco-panel"><h2>${t('sampleQuestions')}</h2><div class="eco-shortcuts">${['saldo','pengeluaran','tabungan','tagihan'].map((v)=>button('eco-ask',html(v),v)).join('')}</div><p class="eco-helper">${t('insufficientInfo')}</p></section></div>`);}
  function getAnswer(q,ctx){
    const s=q.toLowerCase(),ib=internalBalance(ctx),eb=sum(data.banks,'balance');
    if(/saldo|balance|余额|bank/.test(s))return `${t('aiBalance')} ${currency(ib+eb)}. (${t('internalAccounts')}: ${currency(ib)}, ${t('externalAccounts')}: ${currency(eb)}). ${t('bankCaution')}`;
    if(/pengeluaran|expense|spend|支出|belanja|boros/.test(s))return `${t('aiExpense')} ${currency(sum(entries('expense'),'amount'))}. ${t('aiAdvice')}`;
    if(/pemasukan|income|revenue|收入|pendapatan/.test(s))return `${t('aiIncome')} ${currency(sum(entries('income'),'amount'))}. ${t('aiAdvice')}`;
    if(/tabung|goal|saving|储蓄|target/.test(s))return `${t('aiGoals')} ${currency(sum(data.goals,'target'))} (${t('saved')}: ${currency(sum(data.goals,'saved'))}). ${t('aiAdvice')}`;
    if(/tagihan|invoice|bill|账单|hutang/.test(s))return `${t('aiInvoices')} ${currency(billsTotal())}. ${t('aiAdvice')}`;
    return t('aiCannot');
  }
  const seriesMonths = () => {const now=new Date();return Array.from({length:6},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString(locale==='zh'?'zh-CN':locale==='en'?'en-US':'id-ID',{month:'short'})};});};
  function analytics(){
    const months=seriesMonths(),series=months.map(m=>({...m,inc:sum(data.entries.filter(x=>x.date?.startsWith(m.key)&&x.type==='income'),'amount'),out:sum(data.entries.filter(x=>x.date?.startsWith(m.key)&&x.type==='expense'),'amount')}));
    const max=Math.max(1,...series.flatMap(x=>[x.inc,x.out]));
    return layout('analytics','analyticsDesc',`<div class="eco-stats eco-stats-three">${tag(t('income'),currency(sum(entries('income'),'amount')))}${tag(t('expense'),currency(sum(entries('expense'),'amount')))}${tag(t('net'),currency(sum(entries('income'),'amount')-sum(entries('expense'),'amount')))}</div><section class="eco-panel"><h2>${t('cashflow')}</h2><div class="eco-chart">${series.map(m=>`<div class="eco-chart-item"><div class="eco-chart-bars"><div class="eco-chart-bar eco-chart-in" title="${t('income')}: ${currency(m.inc)}" style="height:${Math.max(2,m.inc/max*155)}px"></div><div class="eco-chart-bar eco-chart-out" title="${t('expense')}: ${currency(m.out)}" style="height:${Math.max(2,m.out/max*155)}px"></div></div><span>${html(m.label)}</span></div>`).join('')}</div><p class="eco-helper">🟩 ${t('income')} &nbsp; 🟧 ${t('expense')} • ${t('financialInfo')}</p></section><section class="eco-panel"><h2>${t('recent')}</h2>${recentEntries([...data.entries])}</section>`);
  }
  function banks(ctx){return layout('multiBank','banksDesc',`<div class="eco-stats eco-stats-three">${tag(t('internalAccounts'),currency(internalBalance(ctx)))}${tag(t('externalAccounts'),currency(sum(data.banks,'balance')))}${tag(t('total'),currency(internalBalance(ctx)+sum(data.banks,'balance')))}</div><section class="eco-panel"><div class="eco-panel-head"><h2>${t('externalAccounts')}</h2>${actions('banks')}</div>${entryForm('banks')}${data.banks.map(b=>`<div class="eco-line eco-record"><div><strong>${html(b.name)}</strong><small>${html(b.bank)} · ${html(b.type)} ${b.note?'· '+html(b.note):''}</small></div><b>${currency(b.balance)}</b>${itemBtns('banks',b.id)}</div>`).join('')||`<div class="eco-empty">${t('noBanks')}</div>`}<div class="eco-disclaimer">${t('bankCaution')}</div></section><section class="eco-panel"><h2>${t('internalAccounts')}</h2>${accountList(ctx)}</section>`);}
  function goals(){return layout('goals','goalDesc',`<div class="eco-stats eco-stats-three">${tag(t('target'),currency(sum(data.goals,'target')))}${tag(t('saved'),currency(sum(data.goals,'saved')))}${tag(t('progress'),`${sum(data.goals,'target')?Math.round(100*sum(data.goals,'saved')/sum(data.goals,'target')):0}%`)}</div><section class="eco-panel"><div class="eco-panel-head"><h2>${t('goals')}</h2>${actions('goals')}</div>${entryForm('goals')}${data.goals.map(g=>`<div class="eco-goal-record"><div class="eco-goal-title"><strong>${html(g.name)}</strong><span>${currency(g.saved)} / ${currency(g.target)}</span></div>${pbar(g.saved,g.target)}<div class="eco-goal-toolbar">${itemBtns('goals',g.id)}${button('eco-contribute',t('saveGoal'),g.id,'primary')}</div>${editing?.kind==='contribute'&&editing?.id===g.id?`<form id="eco-contribute-form" data-eco-id="${html(g.id)}" class="eco-contribute">${el(t('contribution'),'amount','0','number','min="1" max="10000000000" step="1" required')}<button class="eco-btn eco-primary" type="submit">${t('saveAllocation')}</button></form>`:''}</div>`).join('')||`<div class="eco-empty">${t('noGoals')}</div>`}</section>`);}
  function invoices(){const todayIso=today(),unpaid=data.invoices.filter(i=>i.status!=='paid');return layout('invoices','invoiceDesc',`<div class="eco-stats eco-stats-three">${tag(t('unpaid'),currency(billsTotal()))}${tag(t('overdue'),String(unpaid.filter(i=>i.due<todayIso).length))}${tag(t('paid'),String(data.invoices.filter(i=>i.status==='paid').length))}</div><section class="eco-panel"><div class="eco-panel-head"><h2>${t('invoices')}</h2>${actions('invoices')}</div>${entryForm('invoices')}${data.invoices.slice().sort((a,b)=>String(a.due).localeCompare(String(b.due))).map(i=>`<div class="eco-line eco-record"><div><strong>${html(i.title)}</strong><small>${html(i.party)} · ${fmtDate(i.due)} ${i.status!=='paid'&&i.due<todayIso?'• '+t('overdue'):''}</small></div><b>${currency(i.amount)}</b><span class="eco-status ${i.status==='paid'?'ok':'pending'}">${i.status==='paid'?t('paid'):t('unpaid')}</span>${itemBtns('invoices',i.id)}${button('eco-invoice-toggle',i.status==='paid'?t('markUnpaid'):t('markPaid'),i.id)}</div>`).join('')||`<div class="eco-empty">${t('noBills')}</div>`}</section>`);}
  function business(){const recordsBusiness=entries(null,'business'),income=sum(recordsBusiness.filter(e=>e.type==='income'),'amount'),expense=sum(recordsBusiness.filter(e=>e.type==='expense'),'amount');return layout('business','businessDesc',`<div class="eco-stats eco-stats-three">${tag(t('income'),currency(income))}${tag(t('expense'),currency(expense))}${tag(t('net'),currency(income-expense))}</div><section class="eco-panel"><div class="eco-panel-head"><h2>${t('business')}</h2><div>${actions('entries')}${button('eco-export',t('businessExport'),'business')}</div></div>${entryForm('entries')}${data.entries.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(e=>`<div class="eco-line eco-record"><div><strong>${html(e.title)}</strong><small>${html(e.category)} • ${fmtDate(e.date)} • ${e.scope==='business'?t('work'):t('personal')}</small></div><b class="${e.type==='income'?'eco-positive':'eco-negative'}">${e.type==='income'?'+':'−'}${currency(e.amount)}</b>${itemBtns('entries',e.id)}</div>`).join('')||`<div class="eco-empty">${t('noData')}</div>`}</section>`);}
  function security(){return layout('security','securityDesc',`<div class="eco-cols"><section class="eco-panel"><h2>${t('changePassword')}</h2><form id="eco-password-form" class="eco-password">${el(t('passwordCurrent'),'old','','password','autocomplete="current-password" required')}${el(t('passwordNew'),'password','','password','minlength="12" autocomplete="new-password" required')}${el(t('passwordConfirm'),'confirm','','password','minlength="12" autocomplete="new-password" required')}<button class="eco-btn eco-primary" type="submit">${t('changePassword')}</button></form></section><section class="eco-panel"><h2>${t('security')}</h2><div class="eco-line"><strong>✓ ${t('securityAuth')}</strong><span>Firebase</span></div><div class="eco-line"><strong>✓ ${t('securityWorkspace')}</strong><span>UID</span></div><p class="eco-helper">${t('securityInfo')}</p></section></div>`);}
  const csvEscape = (value) => {let str=String(value??'');if(/^[=+\-@\t\r]/.test(str))str="'"+str;return '"'+str.replace(/"/g,'""')+'"';};
  function downloadCsv(name, rows, columns){const txt='\uFEFF'+[columns.map(csvEscape).join(','),...rows.map(row=>columns.map(key=>csvEscape(row[key])).join(','))].join('\r\n');const blob=new Blob([txt],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  function reports(ctx){const transactionCount=ctx.isCustomer?(ctx.state.transactions||[]).length:0;return layout('financeReports','reportsDesc',`<div class="eco-stats eco-stats-three">${tag(t('income'),currency(sum(entries('income'),'amount')))}${tag(t('expense'),currency(sum(entries('expense'),'amount')))}${tag(t('transaction'),String(transactionCount+data.entries.length))}</div><section class="eco-panel"><div class="eco-panel-head"><h2>${t('financeReports')}</h2></div><p class="eco-helper">${t('reportsDesc')}</p><div class="eco-export-actions">${button('eco-export',t('reportExport'),'all','primary')}${button('eco-export',t('businessExport'),'business')}</div></section><section class="eco-panel"><h2>${t('recent')}</h2>${recentEntries([...data.entries])}</section>`);}
  function family(){return layout('family','familyDesc',`<div class="eco-stats eco-stats-three">${tag(t('familyMembers'),String(data.familyMembers.length))}${tag(t('budget'),currency(sum(data.familyBudgets,'limit')))}${tag(t('spent'),currency(sum(data.familyBudgets,'used')))}</div><div class="eco-cols"><section class="eco-panel"><div class="eco-panel-head"><h2>${t('familyMembers')}</h2>${actions('familyMembers')}</div>${entryForm('familyMembers')}${data.familyMembers.map(m=>`<div class="eco-line eco-record"><div><strong>${html(m.name)}</strong><small>${html(m.role)}</small></div>${itemBtns('familyMembers',m.id)}</div>`).join('')||`<div class="eco-empty">${t('noData')}</div>`}</section><section class="eco-panel"><div class="eco-panel-head"><h2>${t('familyBudgets')}</h2>${actions('familyBudgets')}</div>${entryForm('familyBudgets')}${data.familyBudgets.map(b=>`<div class="eco-goal-record"><div class="eco-goal-title"><strong>${html(b.category)}</strong><span>${currency(b.used)} / ${currency(b.limit)}</span></div>${pbar(b.used,b.limit)}${itemBtns('familyBudgets',b.id)}</div>`).join('')||`<div class="eco-empty">${t('noData')}</div>`}</section></div>`);}
  function feedbackForm(){return `<form id="eco-feedback-form" class="eco-feedback-form"><div class="eco-form-grid">${choose(t('type'),'type',[['saran',t('suggestion')],['bug',t('bug')],['pujian',t('praise')]])}${el(t('name'),'name','','text','maxlength="80"')}${el(t('email'),'email','','email','maxlength="120"')}<label class="eco-field eco-full"><span>${t('feedbackMessage')}</span><textarea class="textarea" name="message" minlength="10" maxlength="1500" required></textarea></label><input name="website" type="text" tabindex="-1" autocomplete="off" class="eco-honeypot" aria-hidden="true"></div><button type="submit" class="eco-btn eco-primary">${t('submit')}</button></form>`;}
  function feedback(){return layout('feedback','feedbackDesc',`<section class="eco-panel eco-feedback-panel">${feedbackForm()}</section>`);}
  function publicTeaser(){return `<section class="eco-public-teaser"><div class="eco-teaser-heading"><span>✦ SMART FINANCE ECOSYSTEM</span><h2>${locale==='en'?'All your financial tools in one place':locale==='zh'?'一站式智能财务工具':'Kelola keuangan lebih cerdas, dalam satu tempat'}</h2><p>${t('financeIntro')}</p></div><div class="eco-teaser-grid">${names.map(([id,key,ic])=>`<button type="button" class="eco-teaser-tile" data-act="public-view" data-id="customer-login"><span class="eco-teaser-icon">${icon(ic)}</span><strong>${t(key)}</strong><span class="eco-teaser-arrow">↗</span></button>`).join('')}</div><p class="eco-teaser-foot">${t('financialInfo')}</p></section>`;}
  function publicFeedback(){return `<div class="eco-public-feedback"><div class="eco-heading"><div><div class="eco-eyebrow">MILALA BANK</div><h1>${t('feedback')}</h1><p>${t('feedbackDesc')}</p></div></div><section class="eco-panel">${feedbackForm()}</section></div>`;}
  function feedbackInbox(){if(!inboxLoading&&!inboxLoaded&&!error){inboxLoading=true;store.getFeedback().then(r=>{inbox=r.items||[];inboxLoading=false;inboxLoaded=true;onChange();}).catch(e=>{inboxLoading=false;inboxLoaded=true;error=e.message;onChange();});}
    return layout('feedbackInbox','feedbackInboxDesc',`<section class="eco-panel"><div class="eco-panel-head"><h2>${t('feedbackInbox')}</h2>${button('eco-feedback-refresh',t('refresh'))}</div>${inbox.map(f=>`<div class="eco-feedback-item"><div class="eco-feedback-top"><strong>${html(f.name||'Visitor')}</strong><small>${html(f.type)} · ${html(f.createdAt.slice(0,10))} · ${html(f.email)}</small></div><p>${html(f.message)}</p></div>`).join('')||`<div class="eco-empty">${t('noneFound')}</div>`}</section>`);}
  function render(section,ctx){
    if(section==='eco-feedback')return feedback();
    if(section==='eco-feedback-inbox')return feedbackInbox();
    if(!loaded){if(!loadPromise&&!error)ensureLoaded().catch(()=>{});return `<section class="eco-root"><h1>${t('smartDashboard')}</h1><div class="eco-panel">${error?`${html(error)} ${button('eco-retry',t('retry'))}`:'⏳ ...'}</div></section>`;}
    const views={'eco-dashboard':dashboard,'eco-assistant':assistant,'eco-analytics':analytics,'eco-banks':banks,'eco-goals':goals,'eco-invoices':invoices,'eco-business':business,'eco-security':security,'eco-reports':reports,'eco-family':family};
    return (views[section]||dashboard)(ctx);
  }
  const model = (kind,form) => {
    const raw=Object.fromEntries(new FormData(form));
    const val=(k)=>String(raw[k]??'').trim();
    if(kind==='banks')return {name:required(raw.name),bank:required(raw.bank),type:val('type'),balance:limitNum(raw.balance),note:val('note')};
    if(kind==='goals')return {name:required(raw.name),target:limitNum(raw.target),saved:limitNum(raw.saved),note:val('note')};
    if(kind==='invoices')return {title:required(raw.title),party:val('party'),type:['income','expense'].includes(raw.type)?raw.type:'expense',status:['paid','unpaid'].includes(raw.status)?raw.status:'unpaid',amount:limitNum(raw.amount),due:val('due'),note:val('note')};
    if(kind==='entries')return {title:required(raw.title),category:required(raw.category),type:['income','expense'].includes(raw.type)?raw.type:'expense',scope:['personal','business'].includes(raw.scope)?raw.scope:'business',amount:limitNum(raw.amount),date:val('date'),note:val('note')};
    if(kind==='familyMembers')return {name:required(raw.name),role:required(raw.role)};
    if(kind==='familyBudgets')return {category:required(raw.category),limit:limitNum(raw.limit),used:limitNum(raw.used),note:val('note')};
    throw new Error('Invalid form');
  };
  async function click(action,id,ctx){
    if(action==='eco-open'){ctx.navigate(id);return t('refreshed');}
    if(action==='eco-new'){editing={kind:id,id:''};onChange();return null;}
    if(action==='eco-edit'){const [kind,itemId]=id.split(':');editing={kind,id:itemId};onChange();return null;}
    if(action==='eco-cancel'){editing=null;onChange();return null;}
    if(action==='eco-retry'){error='';await ensureLoaded();return t('refreshed');}
    if(action==='eco-delete'){
      const [kind,itemId]=id.split(':');if(!confirm(t('confirmDelete')))return null;
      await mutate(next=>{next[kind]=next[kind].filter(r=>r.id!==itemId);});return t('deleted');
    }
    if(action==='eco-contribute'){editing={kind:'contribute',id};onChange();return null;}
    if(action==='eco-invoice-toggle'){await mutate(next=>{const inv=next.invoices.find(r=>r.id===id);if(!inv)throw new Error('Not found');inv.status=inv.status==='paid'?'unpaid':'paid';});return t('success');}
    if(action==='eco-ask'){answer=getAnswer(id,ctx);onChange();return null;}
    if(action==='eco-export'){
      const items=id==='business'?data.entries.filter(x=>x.scope==='business'):data.entries;
      const rows=items.map(x=>({date:x.date,title:x.title,type:x.type,scope:x.scope,category:x.category,amount:x.amount,note:x.note}));
      if(id==='all'){
        for(const inv of data.invoices)rows.push({date:inv.due,title:inv.title,type:inv.type,scope:'invoice',category:inv.status,amount:inv.amount,note:inv.note||''});
      }
      downloadCsv(`MILALA_Smart_Finance_${id}_${today()}.csv`,rows,['date','title','type','scope','category','amount','note']);return null;
    }
    if(action==='eco-feedback-refresh'){inboxLoading=true;const f=await store.getFeedback();inbox=f.items||[];inboxLoading=false;inboxLoaded=true;onChange();return t('refreshed');}
    return null;
  }
  async function submit(form,ctx){
    if(form.id==='eco-feedback-form'){
      const raw=Object.fromEntries(new FormData(form));await store.submitFeedback(raw);form.reset();return t('feedbackSuccess');
    }
    if(form.id==='eco-assistant-form'){
      const q=String(new FormData(form).get('question')||'').trim();if(q.length<3)throw new Error(t('assistantPrompt'));answer=getAnswer(q,ctx);onChange();return null;
    }
    if(form.id==='eco-password-form'){
      const x=Object.fromEntries(new FormData(form));if(String(x.password||'').length<12||x.password!==x.confirm||x.password===x.old)throw new Error(t('passwordNew'));
      await store.changePassword(x.old,x.password);form.reset();return t('passwordChanged');
    }
    if(form.id==='eco-contribute-form'){
      const amount=limitNum(new FormData(form).get('amount'));if(amount<=0)throw new Error(t('contribution'));
      await mutate(next=>{const item=next.goals.find(g=>g.id===form.dataset.ecoId);if(!item)throw new Error('Not found');item.saved=limitNum(item.saved+amount);});return t('success');
    }
    if(form.id==='eco-record-form'){
      const kind=form.dataset.ecoKind,id=form.dataset.ecoId,values=model(kind,form);
      await mutate(next=>{const items=next[kind];if(id){const idx=items.findIndex(i=>i.id===id);if(idx<0)throw new Error('Not found');items[idx]={...items[idx],...values};}else items.push({id:newId(),...values});});return t('success');
    }
    return null;
  }
  function setLocale(lang){if(!['id','en','zh'].includes(lang))return;locale=lang;document.documentElement.lang=lang==='zh'?'zh-CN':lang;try{localStorage.setItem('milala-language',lang);}catch(_){}onChange();}
  const translatedSource = new WeakMap();
  function translate(root){
    if(!root)return;
    const originals = locale==='en'?legacyLabels:locale==='zh'?legacyZh:null;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(!node.parentElement || ['SCRIPT','STYLE','TEXTAREA','OPTION'].includes(node.parentElement.tagName))continue;
      const original=translatedSource.get(node)??node.nodeValue;
      if(!translatedSource.has(node))translatedSource.set(node,original);
      const leading=original.match(/^\s*/)?.[0]||'', trailing=original.match(/\s*$/)?.[0]||'', value=original.trim();
      const replacement=originals?.[value];
      const next=replacement?leading+replacement+trailing:original;
      if(node.nodeValue!==next)node.nodeValue=next;
    }
  }
  function observe(){
    const root=document.querySelector('#app'),modal=document.querySelector('#modal-root');
    let queued=false;
    const update=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;translate(root);translate(modal);});};
    const observer=new MutationObserver(update);
    if(root)observer.observe(root,{childList:true,subtree:true});if(modal)observer.observe(modal,{childList:true,subtree:true});update();
  }
  return {names,nav,render,publicFeedback,publicTeaser,langSwitch,setLocale,get locale(){return locale;},t,reset,ensureLoaded,click,submit,translate,observe,setOnChange(fn){onChange=fn;},read};
})();
