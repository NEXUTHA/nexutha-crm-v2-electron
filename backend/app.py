"""
NEXUTHA CRM V2 — Backend Server
Python + SQLite + FastAPI
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path

# ================================================================
# 設定
# ================================================================
import sys as _sys
import os as _os
if getattr(_sys, "frozen", False):
    # 配布版: 実行ファイルはContents/Resources/backend
    BASE_DIR = Path(_sys.executable).parent
    STATIC_DIR_OVERRIDE = BASE_DIR  # Resources/直下にindex.htmlがある
else:
    BASE_DIR = Path(__file__).parent
    STATIC_DIR_OVERRIDE = None

# データはアプリ外のユーザーディレクトリに保存
if getattr(_sys, "frozen", False):
    # 配布版: ~/Library/Application Support/NEXUTHA CRM/
    DATA_DIR = Path(_os.path.expanduser("~")) / "Library" / "Application Support" / "NEXUTHA CRM"
else:
    # 開発版: そのままbackend/data/
    DATA_DIR = BASE_DIR / "data"

DB_PATH = DATA_DIR / "nexutha.db"
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="NEXUTHA CRM V2", version="2.0.0")

# CORS設定（フロントエンドからのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================================================
# DB初期化
# ================================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 顧客テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            company TEXT,
            tel TEXT,
            email TEXT,
            address TEXT,
            zip TEXT,
            industry TEXT,
            memo TEXT,
            extra TEXT,
            tags TEXT,
            status TEXT DEFAULT 'active',
            birthday TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    # 既存DBへのマイグレーション
    try:
        cursor.execute("ALTER TABLE customers ADD COLUMN zip TEXT")
    except:
        pass  # カラムが既に存在する場合はスキップ

    # 取引テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            title TEXT,
            status TEXT DEFAULT 'open',
            total REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT
        )
    """)

    # 書類テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            customer_name TEXT,
            type TEXT NOT NULL,
            doc_number TEXT,
            doc_date TEXT,
            notes TEXT,
            items TEXT,
            subtotal REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            tax_rate REAL DEFAULT 10,
            total REAL DEFAULT 0,
            bank_info TEXT,
            versions TEXT,
            transaction_id INTEGER,
            status TEXT DEFAULT 'draft',
            atena TEXT,
            honorific TEXT,
            validity TEXT,
            payment_due TEXT,
            bank TEXT,
            staff TEXT,
            memo TEXT,
            show_stamp INTEGER DEFAULT 0,
            invoice_no TEXT,
            discount TEXT,
            withholding REAL DEFAULT 0,
            tax10 REAL DEFAULT 0,
            tax8 REAL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    """)
    # マイグレーション: 既存テーブルにカラム追加
    existing_cols = [row[1] for row in cursor.execute("PRAGMA table_info(documents)").fetchall()]
    for col, definition in [
        ('transaction_id', 'INTEGER'),
        ('status', "TEXT DEFAULT 'draft'"),
        ('atena', 'TEXT'), ('honorific', 'TEXT'), ('validity', 'TEXT'),
        ('payment_due', 'TEXT'), ('bank', 'TEXT'), ('staff', 'TEXT'),
        ('memo', 'TEXT'), ('show_stamp', 'INTEGER DEFAULT 0'),
        ('invoice_no', 'TEXT'), ('discount', 'TEXT'),
        ('withholding', 'REAL DEFAULT 0'), ('tax10', 'REAL DEFAULT 0'),
        ('tax8', 'REAL DEFAULT 0'),
    ]:
        if col not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE documents ADD COLUMN {col} {definition}")
            except:
                pass

    # ファイルテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            size INTEGER,
            data TEXT,
            meishi INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    # マイグレーション
    existing = [r[1] for r in cursor.execute("PRAGMA table_info(files)").fetchall()]
    if 'meishi' not in existing:
        cursor.execute("ALTER TABLE files ADD COLUMN meishi INTEGER DEFAULT 0")

    # テンプレートテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            items TEXT,
            notes TEXT,
            total REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    # 書類バージョンテーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS doc_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doc_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    # 会社情報テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS company (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    # 設定テーブル
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    conn.commit()
    conn.close()
    print("✓ DB初期化完了:", DB_PATH)

# ================================================================
# モデル定義
# ================================================================
class CustomerCreate(BaseModel):
    name: str
    company: Optional[str] = None
    tel: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    zip: Optional[str] = None
    industry: Optional[str] = None
    memo: Optional[str] = None
    extra: Optional[dict] = None
    tags: Optional[list] = None
    status: Optional[str] = "active"
    birthday: Optional[str] = None

class CustomerUpdate(CustomerCreate):
    pass

class DocumentCreate(BaseModel):
    customer_id: int
    customer_name: Optional[str] = None
    type: str
    doc_number: Optional[str] = None
    doc_date: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list] = None
    subtotal: Optional[float] = 0
    tax: Optional[float] = 0
    tax_rate: Optional[float] = 10
    total: Optional[float] = 0
    bank_info: Optional[dict] = None
    status: Optional[str] = 'draft'
    memo: Optional[str] = None
    atena: Optional[str] = None
    honorific: Optional[str] = None
    staff: Optional[str] = None
    discount: Optional[str] = None
    withholding: Optional[float] = None
    show_stamp: Optional[bool] = None
    invoice_no: Optional[str] = None
    versions: Optional[list] = None

    class Config:
        extra = 'allow'

class DocumentUpdate(BaseModel):
    class Config:
        extra = 'allow'
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    type: Optional[str] = None
    doc_number: Optional[str] = None
    doc_date: Optional[str] = None
    notes: Optional[str] = None
    items: Optional[list] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    tax_rate: Optional[float] = None
    total: Optional[float] = None
    bank_info: Optional[dict] = None
    status: Optional[str] = None
    memo: Optional[str] = None
    atena: Optional[str] = None
    honorific: Optional[str] = None
    staff: Optional[str] = None
    discount: Optional[str] = None
    withholding: Optional[float] = None
    send_memo: Optional[str] = None
    reissued: Optional[bool] = None
    show_stamp: Optional[bool] = None
    versions: Optional[list] = None

class TemplateCreate(BaseModel):
    name: str
    items: Optional[list] = None
    notes: Optional[str] = None
    total: Optional[float] = 0

class DocVersionCreate(BaseModel):
    doc_id: int
    data: dict

# ================================================================
# 静的ファイル配信
# ================================================================
STATIC_DIR = STATIC_DIR_OVERRIDE if STATIC_DIR_OVERRIDE else BASE_DIR.parent

@app.get("/")
def root():
    return FileResponse(str(STATIC_DIR / "index.html"))

@app.get("/index.html")
def index():
    return FileResponse(str(STATIC_DIR / "index.html"))

@app.get("/sw.js")
def sw():
    return FileResponse(str(STATIC_DIR / "sw.js"))

@app.get("/manifest.json")
def manifest():
    return FileResponse(str(STATIC_DIR / "manifest.json"))

@app.get("/favicon.ico")
def favicon():
    return FileResponse(str(STATIC_DIR / "favicon.ico"))

# ================================================================
# ヘルスチェック
# ================================================================
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0", "time": datetime.now().isoformat()}

# ================================================================
# 顧客API
# ================================================================
@app.get("/api/customers")
def get_customers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM customers ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d["extra"] = json.loads(d["extra"]) if d["extra"] else {}
        d["tags"] = json.loads(d["tags"]) if d["tags"] else []
        result.append(d)
    return result

@app.get("/api/customers/{customer_id}")
def get_customer(customer_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    d = dict(row)
    d["extra"] = json.loads(d["extra"]) if d["extra"] else {}
    d["tags"] = json.loads(d["tags"]) if d["tags"] else []
    return d

@app.post("/api/customers")
def create_customer(customer: CustomerCreate):
    now = datetime.now().isoformat()
    conn = get_db()
    cursor = conn.execute("""
        INSERT INTO customers (name, company, tel, email, address, zip, industry, memo, extra, tags, status, birthday, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        customer.name, customer.company, customer.tel, customer.email,
        customer.address, customer.zip, customer.industry, customer.memo,
        json.dumps(customer.extra or {}),
        json.dumps(customer.tags or []),
        customer.status, customer.birthday, now, now
    ))
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    return {"id": new_id, "message": "登録しました"}

@app.put("/api/customers/{customer_id}")
def update_customer(customer_id: int, customer: CustomerUpdate):
    now = datetime.now().isoformat()
    conn = get_db()
    conn.execute("""
        UPDATE customers SET name=?, company=?, tel=?, email=?, address=?, zip=?, industry=?, memo=?, extra=?, tags=?, status=?, birthday=?, updated_at=?
        WHERE id=?
    """, (
        customer.name, customer.company, customer.tel, customer.email,
        customer.address, customer.zip, customer.industry, customer.memo,
        json.dumps(customer.extra or {}),
        json.dumps(customer.tags or []),
        customer.status, customer.birthday, now, customer_id
    ))
    conn.commit()
    conn.close()
    return {"message": "更新しました"}

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    conn = get_db()
    conn.execute("DELETE FROM documents WHERE customer_id = ?", (customer_id,))
    conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
    conn.commit()
    conn.close()
    return {"message": "削除しました"}

# ================================================================
# 書類API
# ================================================================
@app.get("/api/documents")
def get_documents():
    conn = get_db()
    rows = conn.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d["items"] = json.loads(d["items"]) if d["items"] else []
        d["bank_info"] = json.loads(d["bank_info"]) if d["bank_info"] else {}
        d["versions"] = json.loads(d["versions"]) if d["versions"] else []
        result.append(d)
    return result

@app.get("/api/documents/customer/{customer_id}")
def get_customer_documents(customer_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM documents WHERE customer_id = ? ORDER BY created_at DESC", (customer_id,)).fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        d["items"] = json.loads(d["items"]) if d["items"] else []
        d["bank_info"] = json.loads(d["bank_info"]) if d["bank_info"] else {}
        d["versions"] = json.loads(d["versions"]) if d["versions"] else []
        result.append(d)
    return result

@app.post("/api/documents")
def create_document(doc: DocumentCreate):
    now = datetime.now().isoformat()
    # transaction_idが未指定なら自動で取引を作成
    extra = doc.model_extra or {}
    transaction_id = extra.get('transaction_id') or None
    tax10 = extra.get('tax10') or 0
    tax8  = extra.get('tax8') or 0
    validity = extra.get('validity') or None
    payment_due = extra.get('payment_due') or None
    bank = extra.get('bank') or None

    with get_db() as conn:
        if not transaction_id:
            cur_t = conn.execute("""
                INSERT INTO transactions (customer_id, title, status, total, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (doc.customer_id, doc.notes or doc.type, 'open', doc.total or 0, now, now))
            transaction_id = cur_t.lastrowid

        cursor = conn.execute("""
            INSERT INTO documents (
                customer_id, customer_name, type, doc_number, doc_date, notes,
                items, subtotal, tax, tax_rate, total, bank_info, versions,
                transaction_id, status, atena, honorific, validity, payment_due,
                bank, staff, memo, show_stamp, invoice_no, discount,
                withholding, tax10, tax8, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc.customer_id, doc.customer_name, doc.type, doc.doc_number,
            doc.doc_date, doc.notes,
            json.dumps(doc.items or []),
            doc.subtotal, doc.tax, doc.tax_rate, doc.total,
            json.dumps(doc.bank_info or {}),
            json.dumps([]),
            transaction_id,
            doc.status or 'draft',
            doc.atena, doc.honorific,
            validity, payment_due, bank,
            doc.staff, doc.memo,
            1 if doc.show_stamp else 0,
            doc.invoice_no, doc.discount,
            doc.withholding or 0, tax10, tax8,
            now, now
        ))
        conn.commit()
        new_id = cursor.lastrowid
        return {"id": new_id, "transaction_id": transaction_id, "message": "保存しました"}

@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int):
    conn = get_db()
    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()
    return {"message": "削除しました"}

# ================================================================
# 会社情報API
# ================================================================
@app.get("/api/company")
def get_company():
    conn = get_db()
    row = conn.execute("SELECT value FROM company WHERE key = 'info'").fetchone()
    conn.close()
    if not row:
        return {}
    return json.loads(row["value"])

@app.post("/api/company")
def save_company(data: dict):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO company (key, value) VALUES ('info', ?)", (json.dumps(data),))
    conn.commit()
    conn.close()
    return {"message": "保存しました"}

# ================================================================
# 設定API（書類番号採番）
# ================================================================
@app.get("/api/settings/next-doc-number/{doc_type}")
def next_doc_number(doc_type: str):
    conn = get_db()
    key = f"seq_{doc_type}"
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    n = (int(row["value"]) + 1) if row else 1
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(n)))
    conn.commit()
    conn.close()
    year = datetime.now().year
    prefix = "EST" if doc_type == "estimate" else "INV" if doc_type == "invoice" else "REC"
    return {"number": f"{prefix}-{year}-{str(n).zfill(4)}"}

# ================================================================
# 起動
# ================================================================
# 書類API追加分（静的ファイルより前に定義必須）
@app.get("/api/documents/{doc_id}")
def get_document_by_id(doc_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="書類が見つかりません")
    d = dict(row)
    d["items"] = json.loads(d["items"]) if d["items"] else []
    d["bank_info"] = json.loads(d["bank_info"]) if d["bank_info"] else {}
    d["versions"] = json.loads(d["versions"]) if d["versions"] else []
    return d

# 静的ファイル配信（全APIの最後に置く）

# ================================================================
# テンプレートAPI
# ================================================================
@app.get("/api/templates")
def get_templates():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM templates ORDER BY created_at DESC").fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d['items'] = json.loads(d['items'] or '[]')
            result.append(d)
        return result
    finally:
        conn.close()

@app.post("/api/templates")
def create_template(template: TemplateCreate):
    conn = get_db()
    try:
        now = datetime.now().isoformat()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO templates (name, items, notes, total, created_at) VALUES (?, ?, ?, ?, ?)",
            (template.name, json.dumps(template.items or []), template.notes, template.total, now)
        )
        conn.commit()
        return {"id": cursor.lastrowid, "name": template.name}
    finally:
        conn.close()

@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM templates WHERE id=?", (template_id,))
        conn.commit()
        return {"deleted": template_id}
    finally:
        conn.close()

# ================================================================
# 書類バージョンAPI
# ================================================================
@app.get("/api/doc_versions/{doc_id}")
def get_doc_versions(doc_id: int):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM doc_versions WHERE doc_id=? ORDER BY created_at DESC",
            (doc_id,)
        ).fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d['data'] = json.loads(d['data'])
            result.append(d)
        return result
    finally:
        conn.close()

@app.post("/api/doc_versions")
def create_doc_version(version: DocVersionCreate):
    conn = get_db()
    try:
        now = datetime.now().isoformat()
        cursor = conn.cursor()
        rows = conn.execute(
            "SELECT id FROM doc_versions WHERE doc_id=? ORDER BY created_at DESC",
            (version.doc_id,)
        ).fetchall()
        if len(rows) >= 10:
            for r in rows[9:]:
                conn.execute("DELETE FROM doc_versions WHERE id=?", (r['id'],))
        cursor.execute(
            "INSERT INTO doc_versions (doc_id, data, created_at) VALUES (?, ?, ?)",
            (version.doc_id, json.dumps(version.data), now)
        )
        conn.commit()
        return {"id": cursor.lastrowid}
    finally:
        conn.close()

@app.delete("/api/doc_versions/{doc_id}")
def delete_doc_versions(doc_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM doc_versions WHERE doc_id=?", (doc_id,))
        conn.commit()
        return {"deleted": doc_id}
    finally:
        conn.close()

# ================================================================
# ファイル API
# ================================================================

@app.get("/api/files/customer/{customer_id}")
def get_customer_files(customer_id: int):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, customer_id, name, type, size, meishi, created_at FROM files WHERE customer_id=? AND (meishi IS NULL OR meishi=0) ORDER BY created_at DESC",
            (customer_id,)
        ).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/files/meishi/{customer_id}")
def get_customer_meishi(customer_id: int):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, customer_id, name, type, size, data, meishi, created_at FROM files WHERE customer_id=? AND meishi=1 ORDER BY created_at DESC",
            (customer_id,)
        ).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/files/{file_id}")
def get_file(file_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM files WHERE id=?", (file_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="ファイルが見つかりません")
        return dict(row)

@app.post("/api/files")
def upload_file(data: dict):
    now = datetime.now().isoformat()
    with get_db() as conn:
        cur = conn.execute("""
            INSERT INTO files (customer_id, name, type, size, data, meishi, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('customer_id'),
            data.get('name'),
            data.get('type'),
            data.get('size'),
            data.get('data'),
            1 if data.get('meishi') else 0,
            now
        ))
        conn.commit()
        return {"id": cur.lastrowid, "message": "保存しました"}

@app.delete("/api/files/{file_id}")
def delete_file(file_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM files WHERE id=?", (file_id,))
        conn.commit()
        return {"message": "削除しました"}

@app.delete("/api/files/customer/{customer_id}")
def delete_customer_files(customer_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM files WHERE customer_id=?", (customer_id,))
        conn.commit()
        return {"message": "削除しました"}

# ================================================================
# 取引 API
# ================================================================

@app.get("/api/transactions")
def get_transactions():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT t.*, COUNT(d.id) as doc_count
            FROM transactions t
            LEFT JOIN documents d ON d.transaction_id = t.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        """).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/transactions/customer/{customer_id}")
def get_customer_transactions(customer_id: int):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT t.*, COUNT(d.id) as doc_count
            FROM transactions t
            LEFT JOIN documents d ON d.transaction_id = t.id
            WHERE t.customer_id = ?
            GROUP BY t.id
            ORDER BY t.created_at DESC
        """, (customer_id,)).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/transactions/{transaction_id}/documents")
def get_transaction_documents(transaction_id: int):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM documents WHERE transaction_id = ?
            ORDER BY created_at ASC
        """, (transaction_id,)).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            if d.get('items'):
                import json
                try: d['items'] = json.loads(d['items'])
                except: pass
            result.append(d)
        return result

class TransactionCreate(BaseModel):
    customer_id: int
    title: Optional[str] = None
    status: Optional[str] = 'open'
    total: Optional[float] = 0

@app.post("/api/transactions")
def create_transaction(t: TransactionCreate):
    now = datetime.now().isoformat()
    with get_db() as conn:
        cur = conn.execute("""
            INSERT INTO transactions (customer_id, title, status, total, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (t.customer_id, t.title, t.status, t.total, now, now))
        conn.commit()
        return {"id": cur.lastrowid, "message": "取引を作成しました"}

@app.put("/api/transactions/{transaction_id}")
def update_transaction(transaction_id: int, t: TransactionCreate):
    now = datetime.now().isoformat()
    with get_db() as conn:
        conn.execute("""
            UPDATE transactions SET title=?, status=?, total=?, updated_at=?
            WHERE id=?
        """, (t.title, t.status, t.total, now, transaction_id))
        conn.commit()
        return {"message": "更新しました"}

@app.put("/api/transactions/{transaction_id}/status")
def update_transaction_status(transaction_id: int, body: dict):
    status = body.get("status", "open")
    now = datetime.now().isoformat()
    with get_db() as conn:
        conn.execute("UPDATE transactions SET status=?, updated_at=? WHERE id=?",
                     (status, now, transaction_id))
        conn.commit()
        return {"message": "ステータスを更新しました"}

@app.delete("/api/transactions/{transaction_id}")
def delete_transaction(transaction_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM transactions WHERE id=?", (transaction_id,))
        conn.commit()
        return {"message": "削除しました"}

@app.get("/api/settings/license")
def get_license():
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key='license_key'").fetchone()
    conn.close()
    if row:
        return {"key": row[0]}
    return {"key": None}

@app.post("/api/settings/license")
def save_license(data: dict):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('license_key', ?)", (data.get('key'),))
    conn.commit()
    conn.close()
    return {"message": "保存しました"}

@app.get("/api/version")
def get_version():
    import json as _json
    try:
        with open(BASE_DIR.parent / "version.json", "r") as f:
            return _json.load(f)
    except:
        return {"version": "2.1.0", "updates": []}

# ================================================================
# Backup / Restore API（べき等性・トランザクション保証）
# ================================================================

class BackupRestoreRequest(BaseModel):
    version: int
    created_at: str
    customers: list = []
    documents: list = []
    company: dict = {}

@app.post("/api/backup/restore")
def restore_backup(backup: BackupRestoreRequest):
    """
    べき等性保証のリストアエンドポイント。
    - 同じIDのデータは上書き（INSERT OR REPLACE）
    - 全処理をトランザクションで包む（ACID保証）
    - 途中エラーでロールバック
    """
    if not backup.version:
        raise HTTPException(status_code=400, detail="バックアップファイルのバージョン情報がありません")
    if not isinstance(backup.customers, list):
        raise HTTPException(status_code=400, detail="顧客データが不正です")

    conn = get_db()
    counts = {"customers": 0, "documents": 0}

    try:
        conn.execute("BEGIN TRANSACTION")

        for c in backup.customers:
            try:
                conn.execute("""
                    INSERT OR REPLACE INTO customers
                    (id, name, company, tel, email, address, zip, industry,
                     memo, extra, tags, status, birthday, created_at, updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    c.get("id"), c.get("name",""), c.get("company",""),
                    c.get("tel",""), c.get("email",""), c.get("address",""),
                    c.get("zip",""), c.get("industry",""), c.get("memo",""),
                    json.dumps(c.get("extra") or {}),
                    json.dumps(c.get("tags") or []),
                    c.get("status","active"), c.get("birthday",""),
                    c.get("created_at", datetime.now().isoformat()),
                    c.get("updated_at", datetime.now().isoformat()),
                ))
                counts["customers"] += 1
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"顧客データの復元に失敗: {str(e)}")

        for d in backup.documents:
            try:
                conn.execute("""
                    INSERT OR REPLACE INTO documents
                    (id, customer_id, customer_name, type, doc_number, doc_date,
                     notes, items, subtotal, tax, tax_rate, total, bank_info,
                     versions, created_at, updated_at, transaction_id, status,
                     atena, honorific, validity, payment_due, bank, staff, memo,
                     show_stamp, invoice_no, discount, withholding, tax10, tax8)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """, (
                    d.get("id"), d.get("customer_id"), d.get("customer_name",""),
                    d.get("type","estimate"), d.get("doc_number",""), d.get("doc_date",""),
                    d.get("notes",""),
                    (lambda v: json.dumps(v) if isinstance(v, list) else (json.dumps(json.loads(v)) if isinstance(v, str) and v else "[]"))(d.get("items") or []),
                    d.get("subtotal",0), d.get("tax",0), d.get("tax_rate",10),
                    d.get("total",0), d.get("bank_info",""),
                    json.dumps(d.get("versions") or []),
                    d.get("created_at", datetime.now().isoformat()),
                    d.get("updated_at", datetime.now().isoformat()),
                    d.get("transaction_id"), d.get("status","draft"),
                    d.get("atena",""), d.get("honorific","様"),
                    d.get("validity",""), d.get("payment_due",""),
                    d.get("bank",""), d.get("staff",""), d.get("memo",""),
                    1 if d.get("show_stamp") else 0,
                    d.get("invoice_no",""), d.get("discount",""),
                    d.get("withholding",0), d.get("tax10",0), d.get("tax8",0),
                ))
                counts["documents"] += 1
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"書類データの復元に失敗: {str(e)}")

        if backup.company:
            try:
                c = backup.company
                for key, value in c.items():
                    conn.execute(
                        "INSERT OR REPLACE INTO company (key, value) VALUES (?,?)",
                        (key, str(value) if value is not None else "")
                    )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"会社情報の復元に失敗: {str(e)}")

        conn.execute("COMMIT")
        conn.close()
        return {
            "message": "リストア完了",
            "customers": counts["customers"],
            "documents": counts["documents"]
        }

    except HTTPException:
        conn.execute("ROLLBACK")
        conn.close()
        raise
    except Exception as e:
        conn.execute("ROLLBACK")
        conn.close()
        raise HTTPException(status_code=500, detail=f"リストア失敗（ロールバック済）: {str(e)}")


@app.get("/api/backup/export")
def export_backup():
    """
    全データをバックアップ用JSONとして返す。
    """
    conn = get_db()
    try:
        customers = [dict(r) for r in conn.execute("SELECT * FROM customers").fetchall()]
        docs_raw = [dict(r) for r in conn.execute("SELECT * FROM documents").fetchall()]
        documents = []
        for d in docs_raw:
            # itemsを正しくデコード（多重エスケープを解消）
            if d.get("items"):
                val = d["items"]
                # 文字列の場合は正しいリストになるまでデコード
                while isinstance(val, str):
                    try:
                        val = json.loads(val)
                    except:
                        break
                d["items"] = val if isinstance(val, list) else []
            else:
                d["items"] = []
            documents.append(d)
        company_rows = conn.execute("SELECT key, value FROM company").fetchall()
        company = {row[0]: row[1] for row in company_rows}
        conn.close()
        return {
            "version": 3,
            "created_at": datetime.now().isoformat(),
            "customers": customers,
            "documents": documents,
            "company": company
        }
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"バックアップ取得失敗: {str(e)}")


# ================================================================
# 書類API追加
# ================================================================
@app.put("/api/documents/{doc_id}")
def update_document(doc_id: int, doc: DocumentUpdate):
    now = datetime.now().isoformat()
    with get_db() as conn:
        # 既存データを取得
        existing = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="書類が見つかりません")
        ex = dict(existing)
        extra = doc.model_extra or {}
        tax10 = extra.get('tax10') or 0
        tax8  = extra.get('tax8') or 0
        validity    = extra.get('validity')     or ex.get('validity')
        payment_due = extra.get('payment_due')  or ex.get('payment_due')
        bank        = extra.get('bank')         or ex.get('bank')
        transaction_id = extra.get('transaction_id') or ex.get('transaction_id')
        conn.execute("""
            UPDATE documents SET
                customer_id=?, customer_name=?, type=?, doc_number=?, doc_date=?, notes=?,
                items=?, subtotal=?, tax=?, tax_rate=?, total=?, bank_info=?,
                status=?, atena=?, honorific=?, validity=?, payment_due=?,
                bank=?, staff=?, memo=?, show_stamp=?, invoice_no=?, discount=?,
                withholding=?, tax10=?, tax8=?, transaction_id=?, updated_at=?
            WHERE id=?
        """, (
            doc.customer_id or ex['customer_id'],
            doc.customer_name or ex.get('customer_name'),
            doc.type or ex['type'],
            doc.doc_number or ex.get('doc_number'),
            doc.doc_date or ex.get('doc_date'),
            doc.notes if doc.notes is not None else ex.get('notes'),
            json.dumps(doc.items or json.loads(ex['items'] or '[]')),
            doc.subtotal if doc.subtotal is not None else ex.get('subtotal', 0),
            doc.tax if doc.tax is not None else ex.get('tax', 0),
            doc.tax_rate if doc.tax_rate is not None else ex.get('tax_rate', 10),
            doc.total if doc.total is not None else ex.get('total', 0),
            json.dumps(doc.bank_info or {}),
            doc.status or ex.get('status', 'draft'),
            doc.atena or ex.get('atena'),
            doc.honorific or ex.get('honorific'),
            validity, payment_due, bank,
            doc.staff or ex.get('staff'),
            doc.memo if doc.memo is not None else ex.get('memo'),
            1 if doc.show_stamp else (ex.get('show_stamp') or 0),
            doc.invoice_no or ex.get('invoice_no'),
            doc.discount or ex.get('discount'),
            doc.withholding if doc.withholding is not None else ex.get('withholding', 0),
            tax10 or ex.get('tax10', 0),
            tax8  or ex.get('tax8', 0),
            transaction_id,
            now, doc_id
        ))
        conn.commit()
        return {"message": "更新しました"}

@app.put("/api/documents/{doc_id}/status")
def update_document_status(doc_id: int, data: dict):
    conn = get_db()
    conn.execute("UPDATE documents SET status=? WHERE id=?", (data.get("status"), doc_id))
    conn.commit()
    conn.close()
    return {"message": "ステータス更新しました"}


# ===== カレンダーAPI =====

class EventCreate(BaseModel):
    title: str
    customer_id: Optional[int] = None
    start_dt: str  # ISO8601 例: 2026-04-27T10:00
    end_dt: Optional[str] = None
    memo: Optional[str] = None
    color: Optional[str] = "#4A90D9"

class EventUpdate(BaseModel):
    title: Optional[str] = None
    customer_id: Optional[int] = None
    start_dt: Optional[str] = None
    end_dt: Optional[str] = None
    memo: Optional[str] = None
    color: Optional[str] = None

def init_calendar_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS day_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        memo TEXT DEFAULT '',
        color TEXT DEFAULT ''
    )""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS day_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        customer_id INTEGER,
        custom_name TEXT
    )""")
    cursor.execute("""CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        customer_id INTEGER,
        start_dt TEXT NOT NULL,
        end_dt TEXT,
        memo TEXT,
        color TEXT DEFAULT '#4A90D9',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    )""")
    # Migration: add custom_name column and make customer_id nullable in existing DBs
    try:
        cursor.execute("SELECT custom_name FROM day_customers LIMIT 1")
    except Exception:
        try:
            cursor.execute("""
                CREATE TABLE day_customers_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    customer_id INTEGER,
                    custom_name TEXT
                )
            """)
            cursor.execute("INSERT INTO day_customers_new (id, date, customer_id) SELECT id, date, customer_id FROM day_customers")
            cursor.execute("DROP TABLE day_customers")
            cursor.execute("ALTER TABLE day_customers_new RENAME TO day_customers")
        except Exception:
            pass
    conn.commit()
    conn.close()

init_calendar_db()

@app.get("/api/events")
def get_events(year: int = None, month: int = None):
    conn = get_db()
    if year and month:
        prefix = f"{year}-{month:02d}"
        rows = conn.execute(
            "SELECT e.*, c.name as customer_name FROM events e LEFT JOIN customers c ON e.customer_id = c.id WHERE e.start_dt LIKE ? ORDER BY e.start_dt",
            (f"{prefix}%",)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT e.*, c.name as customer_name FROM events e LEFT JOIN customers c ON e.customer_id = c.id ORDER BY e.start_dt"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/events")
def create_event(event: EventCreate):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO events (title, customer_id, start_dt, end_dt, memo, color) VALUES (?, ?, ?, ?, ?, ?)",
        (event.title, event.customer_id, event.start_dt, event.end_dt, event.memo, event.color)
    )
    conn.commit()
    event_id = cur.lastrowid
    conn.close()
    return {"id": event_id, "message": "予定を追加しました"}

@app.put("/api/events/{event_id}")
def update_event(event_id: int, event: EventUpdate):
    conn = get_db()
    fields = []
    values = []
    if event.title is not None:
        fields.append("title = ?"); values.append(event.title)
    if event.customer_id is not None:
        fields.append("customer_id = ?"); values.append(event.customer_id)
    if event.start_dt is not None:
        fields.append("start_dt = ?"); values.append(event.start_dt)
    if event.end_dt is not None:
        fields.append("end_dt = ?"); values.append(event.end_dt)
    if event.memo is not None:
        fields.append("memo = ?"); values.append(event.memo)
    if event.color is not None:
        fields.append("color = ?"); values.append(event.color)
    if not fields:
        conn.close()
        return {"message": "変更なし"}
    fields.append("updated_at = datetime('now','localtime')")
    values.append(event_id)
    conn.execute(f"UPDATE events SET {', '.join(fields)} WHERE id = ?", values)
    conn.commit()
    conn.close()
    return {"message": "予定を更新しました"}

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int):
    conn = get_db()
    conn.execute("DELETE FROM events WHERE id = ?", (event_id,))
    conn.commit()
    conn.close()
    return {"message": "予定を削除しました"}

@app.get("/api/day/{date}")
def get_day(date: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM day_info WHERE date = ?", (date,)).fetchone()
        customers = conn.execute(
            """SELECT dc.id, dc.customer_id, COALESCE(c.name, dc.custom_name) as name,
               c.company, c.memo, dc.custom_name
               FROM day_customers dc
               LEFT JOIN customers c ON dc.customer_id = c.id
               WHERE dc.date = ?""",
            (date,)
        ).fetchall()
        events = conn.execute(
            "SELECT e.*, c.name as customer_name FROM events e LEFT JOIN customers c ON e.customer_id = c.id WHERE e.start_dt LIKE ? ORDER BY e.start_dt",
            (date + "%",)
        ).fetchall()
        return {
            "memo": row["memo"] if row else "",
            "color": row["color"] if row else "",
            "customers": [dict(c) for c in customers],
            "events": [dict(e) for e in events],
        }

@app.post("/api/day/{date}/memo")
async def save_day_memo(date: str, request: Request):
    body = await request.json()
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM day_info WHERE date = ?", (date,)).fetchone()
        if existing:
            conn.execute("UPDATE day_info SET memo = ?, color = ? WHERE date = ?",
                (body.get("memo", ""), body.get("color", ""), date))
        else:
            conn.execute("INSERT INTO day_info (date, memo, color) VALUES (?, ?, ?)",
                (date, body.get("memo", ""), body.get("color", "")))
        conn.commit()
    return {"ok": True}

@app.post("/api/day/{date}/customers")
async def add_day_customer(date: str, request: Request):
    body = await request.json()
    customer_id = body.get("customer_id")
    custom_name = (body.get("custom_name") or "").strip()
    with get_db() as conn:
        if customer_id:
            existing = conn.execute("SELECT id FROM day_customers WHERE date = ? AND customer_id = ?",
                (date, customer_id)).fetchone()
            if not existing:
                conn.execute("INSERT INTO day_customers (date, customer_id) VALUES (?, ?)",
                    (date, customer_id))
                conn.commit()
        elif custom_name:
            conn.execute("INSERT INTO day_customers (date, custom_name) VALUES (?, ?)",
                (date, custom_name))
            conn.commit()
    return {"ok": True}

@app.delete("/api/day/{date}/customers/{entry_id}")
def remove_day_customer(date: str, entry_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM day_customers WHERE id = ? AND date = ?",
            (entry_id, date))
        conn.commit()
    return {"ok": True}

@app.get("/api/day-summary/{year}/{month}")
def get_day_summary(year: int, month: int):
    prefix = f"{year}-{month:02d}"
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM day_info WHERE date LIKE ?", (f"{prefix}%",)
        ).fetchall()
        day_customers = conn.execute(
            """SELECT dc.date, COALESCE(c.name, dc.custom_name) as name
               FROM day_customers dc
               LEFT JOIN customers c ON dc.customer_id = c.id
               WHERE dc.date LIKE ?""",
            (f"{prefix}%",)
        ).fetchall()
    result = {}
    for row in rows:
        result[row["date"]] = {"color": row["color"] or "", "memo": row["memo"] or "", "customers": []}
    for dc in day_customers:
        date = dc["date"]
        if date not in result:
            result[date] = {"color": "", "memo": "", "customers": []}
        result[date]["customers"].append(dc["name"])
    return result

@app.get("/{filename:path}")
def static_file(filename: str):
    # APIパスは除外
    if filename.startswith("api/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")
    headers = {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    file_path = STATIC_DIR / filename
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path), headers=headers)
    # SPAフォールバック
    return FileResponse(str(STATIC_DIR / "index.html"), headers=headers)

init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3456, reload=False)


# ================================================================
# 日付詳細API
