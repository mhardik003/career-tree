import mongoose, { Schema, models } from "mongoose";

const SuggestionSchema = new Schema({
  parent_path: { type: String, required: true },
  suggested_name: { type: String, required: true },
  suggested_description: { type: String, required: true },
  status: { type: String, default: "pending_review" },
  timestamp: { type: Date, default: Date.now },
});

// Prevent recompiling model if it already exists (Next.js hot reload fix)
const Suggestion = models.Suggestion || mongoose.model("Suggestion", SuggestionSchema);

export default Suggestion;