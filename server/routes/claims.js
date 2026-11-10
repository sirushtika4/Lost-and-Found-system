const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const { protect, csrfProtection } = require('../middleware/auth');
const { safeClaim } = require('../models/Claim');
const id = z.string().regex(/^[a-f\d]{24}$/i);
const submission = z.object({ itemId: id, explanation: z.string().trim().min(10).max(2000), evidence: z.string().trim().max(1000).optional() }).strict();
const review = z.object({ status: z.enum(['approved', 'rejected']) }).strict();
const integer = (value, max) => z.string().regex(/^[1-9]\d*$/).default(String(value)).transform(Number).refine(n => Number.isSafeInteger(n) && n <= max);
const listQuery = z.object({ page: integer(1, 1000), limit: integer(12, 50), status: z.enum(['pending', 'approved', 'rejected']).optional() }).strict();
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function createClaimRouter({ config, User, Item }) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(csrfProtection(config));
  router.use((req, res, next) => {
    // Avoid buffered authentication/database queries after the connection is lost.
    if (Item.db && Item.db.readyState !== 1) return res.status(503).json({ message: 'Service temporarily unavailable. Please try again.' });
    return next();
  });
  router.use(protect(config, User));
  const conflict = res => res.status(409).json({ message: 'The item or claim has changed, an active claim already exists, or the item cannot accept more claims. Refresh and try again.' });
  router.post('/', wrap(async (req, res) => {
    const input = submission.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Provide a valid item ID, explanation of 10–2000 characters and optional text evidence up to 1000 characters. Extra fields are not accepted.' });
    const item = await Item.findById(input.data.itemId).lean();
    if (!item) return res.status(404).json({ message: 'Item not found.' });
    if (String(item.userId) === String(req.user._id)) return res.status(403).json({ message: 'You cannot claim your own item.' });
    if (item.type !== 'found' || item.status !== 'open') return res.status(409).json({ message: 'Only open found items can be claimed.' });
    const claim = { _id: new mongoose.Types.ObjectId(), claimantId: req.user._id, explanation: input.data.explanation,
      evidence: input.data.evidence || '', status: 'pending', submittedAt: new Date(), reviewedAt: null, reviewerId: null };
    const updated = await Item.findOneAndUpdate({ _id: item._id, userId: { $ne: req.user._id }, type: 'found', status: 'open',
      approvedClaimId: { $exists: false },
      claims: { $not: { $elemMatch: { claimantId: req.user._id, status: { $in: ['pending', 'approved'] } } } },
      $expr: { $lt: [{ $size: { $ifNull: ['$claims', []] } }, 100] },
    }, { $push: { claims: claim } }, { returnDocument: 'after', runValidators: true }).select('+claims');
    return updated ? res.status(201).json({ success: true, claim: safeClaim(updated, updated.claims.id(claim._id)) }) : conflict(res);
  }));
  const list = received => wrap(async (req, res) => {
    const input = listQuery.safeParse(req.query);
    if (!input.success) return res.status(400).json({ message: 'Invalid claim status or pagination.' });
    const { page, limit, status } = input.data;
    const owner = received ? { userId: req.user._id } : { 'claims.claimantId': req.user._id };
    const match = { ...(!received ? { 'claims.claimantId': req.user._id } : {}), ...(status ? { 'claims.status': status } : {}) };
    const [result] = await Item.aggregate([
      { $match: owner }, { $project: { title: 1, status: 1, claims: 1 } }, { $unwind: '$claims' }, { $match: match },
      { $sort: { 'claims.submittedAt': -1, 'claims._id': -1 } },
      { $facet: { total: [{ $count: 'count' }], records: [{ $skip: (page - 1) * limit }, { $limit: limit }] } },
    ]).option({ maxTimeMS: 3000 });
    const total = result.total[0]?.count || 0;
    return res.json({ success: true, claims: result.records.map(record => safeClaim(record, record.claims)), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  });
  router.get('/mine', list(false));
  router.get('/received', list(true));
  router.param('id', (req, res, next, value) => id.safeParse(value).success ? next() : res.status(400).json({ message: 'Invalid claim ID.' }));
  const load = wrap(async (req, res, next) => {
    const item = await Item.findOne({ 'claims._id': req.params.id }).select('+claims +approvedClaimId');
    if (!item) return res.status(404).json({ message: 'Claim not found.' });
    const claim = item.claims.id(req.params.id);
    const reporter = String(item.userId) === String(req.user._id);
    if (!reporter && String(claim.claimantId) !== String(req.user._id)) return res.status(403).json({ message: 'You cannot access this claim.' });
    req.claimItem = item; req.claim = claim; req.isReporter = reporter;
    return next();
  });
  router.get('/:id', load, (req, res) => res.json({ success: true, claim: safeClaim(req.claimItem, req.claim) }));
  router.patch('/:id/status', load, wrap(async (req, res) => {
    if (!req.isReporter) return res.status(403).json({ message: 'Only the item reporter can review this claim.' });
    const input = review.safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: 'Choose approved or rejected. Extra fields are not accepted.' });
    if (req.claim.status !== 'pending') return res.status(409).json({ message: 'Only pending claims can be reviewed.' });
    const filter = { _id: req.claimItem._id, userId: req.user._id, 'claims': { $elemMatch: { _id: req.claim._id, status: 'pending' } } };
    let updated;
    if (input.data.status === 'approved') {
      // This single-document compare-and-set is the only path to approval.
      Object.assign(filter, { type: 'found', status: 'open', approvedClaimId: { $exists: false } });
      updated = await Item.findOneAndUpdate(filter, [{ $set: {
        approvedClaimId: req.claim._id, status: 'resolved', updatedAt: '$$NOW',
        claims: { $map: { input: '$claims', as: 'claim', in: {
          $cond: [{ $eq: ['$$claim.status', 'pending'] }, { $mergeObjects: ['$$claim', {
            status: { $cond: [{ $eq: ['$$claim._id', req.claim._id] }, 'approved', 'rejected'] },
            reviewedAt: '$$NOW', reviewerId: req.user._id,
          }] }, '$$claim'],
        } } },
      } }], { returnDocument: 'after', updatePipeline: true }).select('+claims');
    } else {
      updated = await Item.findOneAndUpdate(filter, { $set: { 'claims.$.status': 'rejected', 'claims.$.reviewedAt': new Date(), 'claims.$.reviewerId': req.user._id } }, { returnDocument: 'after', runValidators: true }).select('+claims');
    }
    return updated ? res.json({ success: true, claim: safeClaim(updated, updated.claims.id(req.claim._id)) }) : conflict(res);
  }));
  return router;
}
module.exports = { createClaimRouter };
