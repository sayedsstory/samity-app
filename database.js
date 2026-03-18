const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db', 'samity.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create all tables
db.exec(`
  -- Summary/settings table
  CREATE TABLE IF NOT EXISTS summary (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_deposit   INTEGER DEFAULT 375450,
    invested_amount INTEGER DEFAULT 450000,
    total_profit    INTEGER DEFAULT 90890,
    total_expenses  INTEGER DEFAULT 850,
    cash_in_hand    INTEGER DEFAULT 15490,
    grand_total     INTEGER DEFAULT 465490,
    updated_at      TEXT DEFAULT (datetime('now'))
  );

  -- Insert default summary row if not exists
  INSERT OR IGNORE INTO summary (id) VALUES (1);

  -- Members table
  CREATE TABLE IF NOT EXISTS members (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0
  );

  -- Monthly deposits table
  CREATE TABLE IF NOT EXISTS deposits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id  INTEGER NOT NULL REFERENCES members(id),
    month      INTEGER NOT NULL,  -- 0-11 (JS month index)
    year       INTEGER NOT NULL,
    amount     INTEGER DEFAULT 0,
    status     TEXT    DEFAULT 'unpaid' CHECK(status IN ('paid','unpaid','partial')),
    fine       INTEGER DEFAULT 0,
    note       TEXT    DEFAULT '',
    updated_at TEXT    DEFAULT (datetime('now')),
    UNIQUE(member_id, month, year)
  );

  -- Investments table
  CREATE TABLE IF NOT EXISTS investments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    sl         INTEGER,
    name       TEXT NOT NULL,
    amount     INTEGER NOT NULL DEFAULT 0,
    type       TEXT DEFAULT '',
    date       TEXT DEFAULT '',
    purpose    TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Profits table
  CREATE TABLE IF NOT EXISTS profits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    note       TEXT NOT NULL,
    amount     INTEGER NOT NULL DEFAULT 0,
    period     TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Expenses table
  CREATE TABLE IF NOT EXISTS expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  -- Fines table
  CREATE TABLE IF NOT EXISTS fines (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    member_name TEXT NOT NULL,
    period      TEXT NOT NULL,
    amount      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// Seed members if table is empty
const memberCount = db.prepare('SELECT COUNT(*) as c FROM members').get();
if (memberCount.c === 0) {
  const members = [
    'Mahamudul','Mahmudul 2','Bappy','Bappy 2','Motahar','Mithil','Rafi','Alimul',
    'Sujon','Hakim','Misuk','Misuk 2','Sourov','Mohammod','Rayhan','Rayhan 2',
    'Abusayed','Wajed','Shohel'
  ];
  const insert = db.prepare('INSERT INTO members (name, sort_order) VALUES (?, ?)');
  members.forEach((name, i) => insert.run(name, i));
  console.log('✅ Seeded', members.length, 'members');
}

// Seed investments if empty
const invCount = db.prepare('SELECT COUNT(*) as c FROM investments').get();
if (invCount.c === 0) {
  const investments = [
    [1,'Md:Shohag ali',50000,'eri','03/04/23','From land'],
    [2,'Md:Nur mohammod',50000,'eri','04/08/23','From land'],
    [3,'Md:Sabedul islam',50000,'amon','04/08/23','From land'],
    [4,'Md:Kader islam',50000,'eri','20/01/24','From land'],
    [5,'Md:Tohidul shah',50000,'eri','24/01/24','From land'],
    [6,'Md:Abdul allim',50000,'eri','20/01/24','From land'],
    [7,'Md:Sajedul babu',50000,'eri','20/01/24','From land'],
    [8,'Md:Robiul',50000,'amon','15/07/24','From land'],
    [9,'Md:Shohag',50000,'amon','17/07/24','From land'],
    [10,'Md:Mohammod',50000,'amon','17/07/24','From land'],
    [11,'Md:Shohel',50000,'amon','20/07/24','From land'],
    [12,'Md:Sabedul',50000,'amon','20/07/24','From land'],
    [13,'Md:Kader',50000,'amon','28/08/24','From land'],
    [14,'Md:Shohag',50000,'eri','20/01/25','From land'],
    [15,'Md:Mohammod',50000,'eri','23/01/25','From land'],
    [16,'Md:Sabedul',50000,'eri','23/01/25','From land'],
    [17,'Md:Kader',50000,'eri','23/01/25','From land'],
    [18,'Md:Abdul allim',50000,'eri','23/01/25','From land'],
    [19,'Md:Tohidul shah',50000,'eri','23/01/25','From land'],
    [20,'Md:Kader',50000,'amon','18/06/25','From land'],
    [21,'Md:Shohag',50000,'amon','18/06/25','From land'],
    [22,'Md:Abdul allim',50000,'amon','18/06/25','From land'],
    [23,'Md:Mohammod',50000,'amon','18/06/25','From land'],
    [24,'Md:Sabedul',50000,'amon','18/06/25','From land'],
    [25,'Md:Tohidul shah',50000,'amon','18/01/25','From land'],
    [26,'Jahurul',50860,'','08/09/25','From fertilizer'],
    [27,'Md:Babu sir',50000,'amon','14/09/25','From land'],
    [28,'Md:Robiul',50000,'eri','14/03/26','From land'],
  ];
  const ins = db.prepare('INSERT INTO investments (sl,name,amount,type,date,purpose) VALUES (?,?,?,?,?,?)');
  investments.forEach(r => ins.run(...r));
  console.log('✅ Seeded', investments.length, 'investments');
}

// Seed profits if empty
const profCount = db.prepare('SELECT COUNT(*) as c FROM profits').get();
if (profCount.c === 0) {
  const profits = [
    ['Md:Shohag ali — eri return (03/04/23)',1000,'2023'],
    ['Md:Nur mohammod — eri return (04/08/23)',2000,'2023'],
    ['Md:Sabedul islam — amon return (04/08/23)',2000,'2023'],
    ['Md:Kader islam — eri return (20/01/24)',2500,'2024'],
    ['Md:Tohidul shah — eri return (24/01/24)',2500,'2024'],
    ['Md:Abdul allim — eri return (20/01/24)',2500,'2024'],
    ['Md:Sajedul babu — eri return (20/01/24)',2500,'2024'],
    ['Md:Robiul — amon return (15/07/24)',2500,'2024'],
    ['Md:Shohag — amon return (17/07/24)',2500,'2024'],
    ['Md:Mohammod — amon return (17/07/24)',2500,'2024'],
    ['Md:Shohel — amon return (20/07/24)',2500,'2024'],
    ['Md:Sabedul — amon return (20/07/24)',2500,'2024'],
    ['Md:Kader — amon return (28/08/24)',2500,'2024'],
    ['Md:Shohag — eri return (20/01/25)',2750,'2025'],
    ['Md:Mohammod — eri return (23/01/25)',2750,'2025'],
    ['Md:Sabedul — eri return (23/01/25)',2750,'2025'],
    ['Md:Kader — eri return (23/01/25)',2750,'2025'],
    ['Md:Abdul allim — eri return (23/01/25)',2750,'2025'],
    ['Md:Tohidul shah — eri return (23/01/25)',2500,'2025'],
    ['Md:Kader — amon return (18/06/25)',2750,'2025'],
    ['Md:Shohag — amon return (18/06/25)',2750,'2025'],
    ['Md:Abdul allim — amon return (18/06/25)',2750,'2025'],
    ['Md:Mohammod — amon return (18/06/25)',2750,'2025'],
    ['Md:Sabedul — amon return (18/06/25)',2750,'2025'],
    ['Md:Tohidul shah — amon return (18/01/25)',2750,'2025'],
    ['Jahurul — fertilizer return (08/09/25)',4640,'2025'],
    ['Md:Babu sir — amon return (14/09/25)',2000,'2025'],
    ['Md:Robiul — eri return (14/03/26)',2500,'2026'],
  ];
  const ins = db.prepare('INSERT INTO profits (note,amount,period) VALUES (?,?,?)');
  profits.forEach(r => ins.run(...r));
  console.log('✅ Seeded', profits.length, 'profits');
}

// Seed expenses if empty
const expCount = db.prepare('SELECT COUNT(*) as c FROM expenses').get();
if (expCount.c === 0) {
  const expenses = [
    ['Deed on Land',150],['Deed on Land',150],['Deed on Land',50],
    ['Stamp',200],['Deed on land',50],['Deed on land',50],
    ['Deed on land',50],['Deed on land',30],['Deed on land',30],
  ];
  const ins = db.prepare('INSERT INTO expenses (description,amount) VALUES (?,?)');
  expenses.forEach(r => ins.run(...r));
  console.log('✅ Seeded', expenses.length, 'expenses');
}

// Seed fines if empty
const fineCount = db.prepare('SELECT COUNT(*) as c FROM fines').get();
if (fineCount.c === 0) {
  const fines = [
    ['Sourov','Sep 2025',50],['Alimul','Sep 2025',50],
    ['Alimul','Nov 2025',50],['Alimul','Dec 2025',50],['Mithil','Dec 2025',50],
  ];
  const ins = db.prepare('INSERT INTO fines (member_name,period,amount) VALUES (?,?,?)');
  fines.forEach(r => ins.run(...r));
  console.log('✅ Seeded', fines.length, 'fines');
}

console.log('✅ Database ready:', DB_PATH);

module.exports = db;
