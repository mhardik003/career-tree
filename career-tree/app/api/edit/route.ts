import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Edit from '@/models/Edit';
import { z } from "zod";
import { checkRateLimit } from '@/lib/rateLimit';


// Define the shape of the data inside "newData"
// .trim() removes whitespace, .max() prevents database spam
export const NodeDataSchema = z.object({
  node_title: z.string().min(3, "Title is required").max(100).trim(),
  description: z.string().min(1, "Description is required").max(2000).trim(),
  difficulty_rating: z.number().min(1).max(10),
  
  avg_cost_inr: z.string().max(100).trim().optional(),
  duration_years: z.string().max(100).trim().optional(),
  
  // Validate arrays of strings
  exams_to_give: z.array(z.string().trim()).optional().nullable(),
  certifications: z.array(z.string().trim()).optional().nullable(),
  qualifications_needed: z.array(z.string().trim()).optional().nullable(),
  top_colleges_or_companies: z.array(z.string().trim()).optional().nullable(),
  tools_and_resources: z.array(z.string().trim()).optional().nullable(),
  real_life_applications: z.array(z.string().trim()).optional().nullable(),
});

// Define the full API Request body
export const EditSubmissionSchema = z.object({
  nodeKey: z.string().min(1),
  // We utilize .passthrough() or .any() for originalData as we just store it as a snapshot
  // But strict validation is better if you know the exact shape
  originalData: NodeDataSchema, 
  newData: NodeDataSchema,
});


export async function POST(request: Request) {
  try {

    const allowed = await checkRateLimit();
    if (!allowed) {
      return NextResponse.json({ success: false, message: "Too many requests. Slow down." }, { status: 429 });
    }

    const body = await request.json();
    
    const validation = EditSubmissionSchema.safeParse(body);

    if (!validation.success) {
      // Return specific validation errors so the frontend knows what's wrong
      return NextResponse.json(
        { success: false, message: "Invalid data format", errors: validation.error.format() }, 
        { status: 400 } // 400 Bad Request
      );
    }

    // 4. Data is clean, proceed to DB
    await dbConnect();
    
    const { nodeKey, originalData, newData } = validation.data;
    await Edit.create({
      target_node_key: nodeKey,
      original_data: originalData,
      proposed_data: newData,
      status: 'pending_review'
    });

    return NextResponse.json({ success: true, message: "Edit request saved to Database!" });

  } catch (error) {
    console.error("Edit API Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
