# Entity Relationship Diagram — MILALA BANK

ERD berikut adalah **model basis data konseptual** untuk kemungkinan backend di masa depan, bukan basis data aktif pada prototipe. Versi HTML saat ini menggunakan objek JSON LocalStorage.

```mermaid
erDiagram
    BRANCH ||--o{ USER : employs
    BRANCH ||--o{ CUSTOMER : serves
    BRANCH ||--o{ ACCOUNT : manages
    CUSTOMER ||--o{ ACCOUNT : owns
    CUSTOMER ||--o{ LOAN : borrows
    ACCOUNT ||--o{ LOAN : receives_disbursement
    USER ||--o{ TRANSACTION : records
    USER ||--o{ AUDIT_LOG : performs
    TRANSACTION ||--|{ JOURNAL_ENTRY : posts
    USER ||--o{ LOAN : approves
    BRANCH {
        string id PK
        string code UK
        string name
        string city
        boolean active
    }
    USER {
        string id PK
        string email UK
        string name
        string password_demo
        string role
        string branch FK
        boolean active
    }
    CUSTOMER {
        string id PK
        string name
        string identity_demo UK
        string branch FK
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

**Perhatian:** `TRANSACTION.from`, `TRANSACTION.to`, serta `JOURNAL_ENTRY.account` dapat menunjuk rekening nasabah ataupun akun sistem simulasi (`GL-CASH`, `GL-LOANFUND`), sehingga model nyata harus menormalkan akun GL sebagai entitas tersendiri. `settings` dan `counters` disimpan sebagai metadata dokumen JSON versi prototipe.
