const express = require('express');
const { z } = require('zod');
const { protect, csrfProtection } = require('../middleware/auth');
const { safeItem, categories } = require('../models/Item');
const text = max => z.string().trim().min(1).max(max);
const optionalText = max => z.string().trim().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= new Date().toISOString().slice(0, 10);
});
const image = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
});
const fields = { title: text(150), description: text(4000), type: z.enum(['lost', 'found']), category: z.enum(categories),
  color: optionalText(80), brand: optionalText(100), location: text(200), dateLostOrFound: date, image };
const creation = z.object(fields).strict();
const update = z.object({ ...fields, status: z.enum(['open', 'resolved']) }).partial().strict().refine(value => Object.keys(value).length > 0);
const positive = (fallback, max) => z.string().regex(/^[1-9]\d*$/).default(String(fallback)).transform(Number).refine(value => Number.isSafeInteger(value) && value <= max);
const querySchema = z.object({ search: optionalText(100).optional(), location: optionalText(100).optional(),
  type: z.enum(['lost', 'found']).optional(), category: z.enum(categories).optional(), status: z.enum(['open', 'resolved']).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'), page: positive(1, 1000), limit: positive(12, 50) }).strict();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function createItemRouter({ config, User, Item }) {
  const router = express.Router();
  const authenticated = protect(config, User);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(csrfProtection(config));
  const list = mine => wrap(async (req, res) => {
    const input = querySchema.safeParse(req.query);
    if (!input.success) return res.status(400).json({ message: 'Invalid search, filter or pagination parameters.' });
    const { search, location, type, category, status, sort, page, limit } = input.data;
    const filter = {};
    if (mine) filter.userId = req.user._id;
    for (const [key, value] of Object.entries({ type, category, status })) if (value) filter[key] = value;
    if (location) filter.location = { $regex: escapeRegex(location), $options: 'i' };
    if (search) filter.$or = ['title', 'description', 'location'].map(key => ({ [key]: { $regex: escapeRegex(search), $options: 'i' } }));
    const [total, records] = await Promise.all([
      Item.countDocuments(filter).maxTimeMS(3000),
      Item.find(filter).sort({ createdAt: sort === 'oldest' ? 1 : -1, _id: sort === 'oldest' ? 1 : -1 }).skip((page - 1) * limit).limit(limit).maxTimeMS(3000).lean(),
    ]);
    return res.json({ success: true, items: records.map(safeItem), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  });
  router.get('/', list(false));
  router.get('/mine', authenticated, list(true));
  router.post('/', authenticated, wrap(async (req, res) => {
    const input = creation.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Invalid item fields. Check required fields, lengths, category, date and HTTPS image URL. Extra fields are not accepted.' });
    const item = await Item.create({ ...input.data, userId: req.user._id, status: 'open' });
    return res.status(201).json({ success: true, item: safeItem(item) });
  }));
  router.param('id', (req, res, next, id) => /^[a-f\d]{24}$/i.test(id) ? next() : res.status(400).json({ message: 'Invalid item ID.' }));
  router.get('/:id', wrap(async (req, res) => {
    const item = await Item.findById(req.params.id).lean();
    return item ? res.json({ success: true, item: safeItem(item) }) : res.status(404).json({ message: 'Item not found.' });
  }));
  const modify = remove => wrap(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    if (String(item.userId) !== String(req.user._id) && req.user.role !== 'admin') return res.status(403).json({ message: 'You cannot modify this item.' });
    // Recheck ownership atomically with the write; never accept it in the request body.
    const filter = { _id: item._id, ...(req.user.role === 'admin' ? {} : { userId: req.user._id }) };
    if (remove) {
      const result = await Item.deleteOne({ ...filter, 'claims.0': { $exists: false } });
      return result.deletedCount ? res.status(204).end() : res.status(409).json({ message: 'Items with claim history cannot be deleted. Refresh the item.' });
    }
    const input = update.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Invalid item update. Ownership and server fields cannot be changed.' });
    if (input.data.type && input.data.type !== item.type) filter['claims.0'] = { $exists: false };
    if (input.data.status) {
      filter.approvedClaimId = { $exists: false };
      filter.claims = { $not: { $elemMatch: { status: 'pending' } } };
    }
    const updated = await Item.findOneAndUpdate(filter, { $set: input.data }, { returnDocument: 'after', runValidators: true });
    return updated ? res.json({ success: true, item: safeItem(updated) }) : res.status(409).json({ message: 'Claim history or pending reviews prevent this change. Refresh and review claims first.' });
  });
  router.patch('/:id', authenticated, modify(false));
  router.delete('/:id', authenticated, modify(true));
  return router;
}
module.exports = { createItemRouter };
