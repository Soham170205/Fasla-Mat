import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 20 },
    displayName: { type: String, required: true, maxlength: 24 },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', userSchema);
