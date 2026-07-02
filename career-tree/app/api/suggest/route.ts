import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rateLimit';


// Define the Schema
const suggestSchema = z.object({
  title: z.string().min(5).max(50).trim(), // Must be 5-50 chars
  description: z.string().min(10).max(500).trim(), // Prevent massive text
  parentPath: z.string().min(1)
});


export async function POST(request: Request) {
  try {

    // Check rate limit
    const allowed = checkRateLimit(request);
    if (!allowed) {
      return NextResponse.json(
        { success: false, message: "Too many requests. Slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await request.json();

    // Validate
    const result = suggestSchema.safeParse(body);
    if (!result.success) {
      // Return exact error to help debugging (or just generic 400)
      return NextResponse.json({
        success: false,
        message: "Invalid input",
        errors: result.error.flatten()
      }, { status: 400 });
    }

    const cleanData = result.data; // Use the sanitized data

    // Create entry in Supabase
    const supabase = getSupabase();
    const { error } = await supabase.from('suggestions').insert({
      parent_path: cleanData.parentPath,
      suggested_name: cleanData.title,
      suggested_description: cleanData.description,
      status: 'pending_review'
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: "Suggestion saved to Database!" });

  } catch (error) {
    console.error("Suggestion API Error:", error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
