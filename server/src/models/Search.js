import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({}, { strict: false, _id: false });
const searchSchema = new mongoose.Schema({
  userQuery: { type: String, required: true },
  parsedRequirements: { type: mongoose.Schema.Types.Mixed, required: true },
  searchQueries: { type: [String], default: [] },
  agentSteps: { type: [String], default: [] },
  products: { type: [productSchema], default: [] },
  recommendations: { type: [productSchema], default: [] },
  summary: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Search', searchSchema);
