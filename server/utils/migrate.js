const db = require('../config/db');

async function ensureSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_schema_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const done = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(done.map((row) => row.name));

  if (!applied.has('phase3_indexes')) {
    applied.add('phase3_indexes');
    await db.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', ['phase3_indexes']);
  }
}

module.exports = { ensureSchema };
