# Entity Relationship Diagram — MILALA BANK

Data bisnis lama tetap dipertahankan pada node `/milala_core_banking`. Browser tidak membaca atau menulis node ini secara langsung; Vercel Serverless Functions menggunakan Admin SDK setelah memvalidasi Firebase ID token, identitas, dan role.

```mermaid
erDiagram
    BRANCH ||--o{ STAFF_PROFILE : assigns
    BRANCH ||--o{ CUSTOMER : serves
    BRANCH ||--o{ ACCOUNT : manages
    CUSTOMER ||--o{ ACCOUNT : owns
    CUSTOMER ||--o| CUSTOMER_PROFILE : accesses_portal
    CUSTOMER ||--o{ LOAN : borrows
    ACCOUNT ||--o{ LOAN : receives_disbursement
    STAFF_PROFILE ||--o{ TRANSACTION : records
    STAFF_PROFILE ||--o{ AUDIT_LOG : performs
    TRANSACTION ||--|{ JOURNAL_ENTRY : posts
    STAFF_PROFILE ||--o{ LOAN : approves
    BRANCH {
        string id PK
        string code UK
        string name
        string city
        boolean active
    }
    STAFF_PROFILE {
        string uid PK
        string staffId UK
        string email
        string role
        string branch FK
        boolean active
    }
    CUSTOMER_PROFILE {
        string uid PK
        string customerId FK
        string email
        boolean active
    }
    CUSTOMER {
        string id PK
        string name
        string identity_demo UK
        string branch FK
        string authUid
        string status
    }
    ACCOUNT {
        string id PK
        string number UK
        string customerId FK
        string branch FK
        string product
        string status
    }
    TRANSACTION {
        string id PK
        string from
        string to
        int amount_rupiah
        string type
        string actor FK
        datetime date
    }
    JOURNAL_ENTRY {
        string id PK
        string transactionId FK
        string account
        int delta_rupiah
    }
    LOAN {
        string id PK
        string customerId FK
        string accountId FK
        int principal_rupiah
        int outstanding_rupiah
        string status
        string approvedBy FK
    }
    AUDIT_LOG {
        string id PK
        string actor FK
        string action
        string module
        datetime date
    }
```

## Node penting

- `/milala_core_banking`: data bisnis lama (nasabah, rekening, transaksi, jurnal, kredit, cabang, staf, audit, settings, counters).
- `/milala_secure/staffProfiles/{uid}`: pemetaan UID Firebase Auth ke ID staf dan role.
- `/milala_secure/customerProfiles/{uid}`: pemetaan UID Firebase Auth ke ID nasabah.
- `/milala_secure/pendingRegistrations/{uid}`: data registrasi sementara sebelum verifikasi email.

Tidak ada password plaintext di Realtime Database setelah migrasi. Kredensial disimpan dan diverifikasi oleh Firebase Authentication. Custom Claims role hanya ditetapkan oleh Admin SDK.

**Catatan:** `TRANSACTION.from`, `TRANSACTION.to`, dan `JOURNAL_ENTRY.account` dapat menunjuk rekening virtual ataupun akun sistem simulasi (`GL-CASH`, `GL-LOANFUND`). Ini tetap model ledger latihan, bukan general ledger bank produksi.
