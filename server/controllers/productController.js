const db = require('../config/db');
const AppError = require('../utils/AppError');
const { writeAuditLog } = require('../utils/audit');
const { sanitizeString, parsePositiveInt } = require('../utils/validate');

async function listProducts(req, res, next) {
  try {
    const includeInactive = req.user && req.user.role === 'ADMIN' && req.query.all === '1';
    const products = await db.query(
      `SELECT id, product_name, product_code, manufacturer, description, is_active, created_at, updated_at
       FROM products
       ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY product_name ASC`
    );

    res.json({ data: products });
  } catch (error) {
    next(error);
  }
}

function parseProduct(body, { partial = false } = {}) {
  const data = {};
  if (!partial) {
    if (!sanitizeString(body.product_name, 200) || !sanitizeString(body.product_code, 50) || !sanitizeString(body.manufacturer, 200)) {
      throw new AppError(400, 'product_name, product_code, and manufacturer are required');
    }
  }
  if (body.product_name !== undefined) data.product_name = sanitizeString(body.product_name, 200);
  if (body.product_code !== undefined) data.product_code = sanitizeString(body.product_code, 50);
  if (body.manufacturer !== undefined) data.manufacturer = sanitizeString(body.manufacturer, 200);
  if (body.description !== undefined) data.description = sanitizeString(body.description, 4000);
  if (body.is_active !== undefined) data.is_active = body.is_active ? 1 : 0;
  return data;
}

async function createProduct(req, res, next) {
  try {
    const payload = parseProduct(req.body);
    const result = await db.query(
      `INSERT INTO products (product_name, product_code, manufacturer, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.product_name, payload.product_code, payload.manufacturer, payload.description || null, payload.is_active === undefined ? 1 : payload.is_active]
    );
    const rows = await db.query('SELECT * FROM products WHERE id = ? LIMIT 1', [result.insertId]);
    await writeAuditLog({
      userId: req.user.id,
      action: 'PRODUCT_CREATE',
      entityType: 'product',
      entityId: result.insertId,
      details: { product_code: payload.product_code },
      ipAddress: req.ip
    });
    res.status(201).json({ product: rows[0] });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = parsePositiveInt(req.params.id, 'id');
    const payload = parseProduct(req.body, { partial: true });
    if (!Object.keys(payload).length) {
      throw new AppError(400, 'No valid fields provided for update');
    }
    const existing = await db.query('SELECT id FROM products WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) throw new AppError(404, 'Product not found');

    const fields = [];
    const values = [];
    Object.keys(payload).forEach((key) => {
      fields.push(`${key} = ?`);
      values.push(payload[key]);
    });
    values.push(id);
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    const rows = await db.query('SELECT * FROM products WHERE id = ? LIMIT 1', [id]);
    await writeAuditLog({
      userId: req.user.id,
      action: 'PRODUCT_UPDATE',
      entityType: 'product',
      entityId: id,
      details: { fields: Object.keys(payload) },
      ipAddress: req.ip
    });
    res.json({ product: rows[0] });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listProducts,
  createProduct,
  updateProduct
};
