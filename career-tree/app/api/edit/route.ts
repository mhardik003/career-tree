import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rateLimit';
import { EditSubmissionSchema } from '@/lib/schemas';
import { v2Graph } from '@/lib/v2/data';


export async function POST(request: Request) {
  try {

    const allowed = checkRateLimit(request);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const validation = EditSubmissionSchema.safeParse(body);

    if (!validation.success) {
      // Return specific validation errors so the frontend knows what's wrong
      return NextResponse.json(
        { success: false, message: "Invalid data format", errors: validation.error.format() },
        { status: 400 } // 400 Bad Request
      );
    }

    const { targetNodeId, proposedData } = validation.data;
    const targetNode = v2Graph.getNodeById(targetNodeId);

    if (!targetNode) {
      return NextResponse.json(
        { success: false, message: "Unknown target node — this node doesn't exist in the tree." },
        { status: 400 }
      );
    }

    const originalData = {
      title: targetNode.title,
      description: targetNode.description,
      aliases: targetNode.aliases,
    };

    if (JSON.stringify(originalData) === JSON.stringify(proposedData)) {
      return NextResponse.json(
        { success: false, message: "The proposed data does not change this node." },
        { status: 409 }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('edits').insert({
      target_node_id: targetNodeId,
      original_data: originalData,
      proposed_data: proposedData,
      status: 'pending_review'
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Edit request saved to Database!" });

  } catch (error) {
    console.error("Edit API Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
