import mongoose, { Schema, models } from "mongoose";

const EditSchema = new Schema({
  target_node_key: { type: String, required: true },
  
  // We use Schema.Types.Mixed because the structure of original/proposed data 
  // might change slightly depending on what we track.
  original_data: { type: Schema.Types.Mixed, required: true },
  proposed_data: { type: Schema.Types.Mixed, required: true },
  
  status: { type: String, default: "pending_review" },
  timestamp: { type: Date, default: Date.now },
});

const Edit = models.Edit || mongoose.model("Edit", EditSchema);

export default Edit;