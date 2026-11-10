const mongoose = require('mongoose');
// Embedded in Item: approval, competing claims and item resolution share one atomic write.
const claimSchema = new mongoose.Schema({
  claimantId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  explanation: { type: String, required: true, maxlength: 2000 },
  evidence: { type: String, default: '', maxlength: 1000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  submittedAt: { type: Date, required: true },
  reviewedAt: { type: Date, default: null },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { autoCreate: false, autoIndex: false });
function safeClaim(item, claim) {
  return { _id: String(claim._id), itemId: String(item._id), itemTitle: item.title,
    itemStatus: item.status, claimantId: String(claim.claimantId),
    explanation: claim.explanation, evidence: claim.evidence || '', status: claim.status,
    submittedAt: claim.submittedAt, reviewedAt: claim.reviewedAt || null,
    reviewerId: claim.reviewerId ? String(claim.reviewerId) : null };
}
module.exports = { claimSchema, safeClaim };
