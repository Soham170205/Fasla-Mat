import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 20 },
    vendorId: String,
    vendorName: String,
    item: String,
    openingPrice: Number,
    finalPrice: Number,
    savingsPct: Number,
    turns: Number,
    score: { type: Number, index: true },
    sessionId: { type: String, unique: true }
  },
  { timestamps: true }
);

export default mongoose.models.Score || mongoose.model('Score', scoreSchema);
